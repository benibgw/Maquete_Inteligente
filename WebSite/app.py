import json
import os
import queue
import threading
import time
from functools import wraps

import paho.mqtt.client as mqtt
from flask import (
    Flask,
    Response,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    stream_with_context,
    url_for,
)
from werkzeug.security import check_password_hash, generate_password_hash

import db

MQTT_BROKER = os.getenv("MQTT_BROKER", "broker.mqtt.cool")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_USERNAME = os.getenv("MQTT_USERNAME") or None
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD") or None
MQTT_ROOT_TOPIC = "maquete_inteligente"
STATUS_TOPIC = f"{MQTT_ROOT_TOPIC}/status/online"
ONLINE_TIMEOUT = float(os.getenv("ONLINE_TIMEOUT", 40.0))

WEB_HOST = os.getenv("WEB_HOST", "0.0.0.0")
WEB_PORT = int(os.getenv("WEB_PORT", 5000))
WEB_USER = os.getenv("WEB_USER", "admin")
WEB_PASSWORD = os.getenv("WEB_PASSWORD", "maquete")
SECRET_KEY = os.getenv("SECRET_KEY", "maquete-secret-key")

SSE_KEEPALIVE = 5.0

app = Flask(__name__)
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.secret_key = SECRET_KEY

PASSWORD_HASH = generate_password_hash(WEB_PASSWORD)

state_lock = threading.Lock()
state = {}
last_heartbeat = 0.0

state.update(db.load_state())
db.prune_old_data()

try:
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
except AttributeError:
    client = mqtt.Client()

if MQTT_USERNAME and MQTT_PASSWORD:
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

subscribers = set()
subscribers_lock = threading.Lock()


def get_online(now=None):
    now = now if now is not None else time.time()
    with state_lock:
        alive = (now - last_heartbeat) < ONLINE_TIMEOUT
        return state.get(STATUS_TOPIC) is True and alive


def build_snapshot():
    with state_lock:
        snapshot = {t: v for t, v in state.items() if t != STATUS_TOPIC}
        alive = (time.time() - last_heartbeat) < ONLINE_TIMEOUT
        online = state.get(STATUS_TOPIC) is True and alive
    return {"online": online, "state": snapshot}


def broadcast(topic, value):
    if topic == STATUS_TOPIC:
        return
    payload = json.dumps({"topic": topic, "value": value})
    with subscribers_lock:
        for sub in list(subscribers):
            try:
                sub.put_nowait(payload)
            except queue.Full:
                subscribers.discard(sub)


def on_connect(client, userdata, flags, reason_code, properties=None):
    client.subscribe(f"{MQTT_ROOT_TOPIC}/#")


def on_message(client, userdata, msg):
    global last_heartbeat

    if msg.topic.startswith(f"{MQTT_ROOT_TOPIC}/test/"):
        return

    try:
        value = json.loads(msg.payload.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        value = msg.payload.decode("utf-8", errors="ignore")

    previous = None
    with state_lock:
        previous = state.get(msg.topic)
        state[msg.topic] = value
        if msg.topic == STATUS_TOPIC and value is True:
            last_heartbeat = time.time()

    if (
        isinstance(value, bool)
        and previous is not None
        and previous != value
        and not msg.topic.endswith("/command")
    ):
        db.record_event(msg.topic, value, "state")

    if msg.topic != STATUS_TOPIC and not msg.topic.endswith("/command"):
        db.save_state(msg.topic, value)
    db.record_reading(msg.topic, value)

    broadcast(msg.topic, value)


def mqtt_worker():
    client.on_connect = on_connect
    client.on_message = on_message
    while True:
        try:
            client.connect(MQTT_BROKER, MQTT_PORT)
            print(f"Conectado ao broker MQTT: {MQTT_BROKER}:{MQTT_PORT}")
            client.loop_forever()
        except Exception as error:
            print(f"Erro MQTT: {error}. Reconectando em 5s...")
            time.sleep(5)


def start_mqtt():
    thread = threading.Thread(target=mqtt_worker, daemon=True)
    thread.start()


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("logged_in"):
            if request.path.startswith("/api/"):
                return jsonify({"ok": False, "error": "nao autenticado"}), 401
            return redirect(url_for("login"))
        return fn(*args, **kwargs)

    return wrapper


@app.route("/login", methods=["GET", "POST"])
def login():
    if session.get("logged_in"):
        return redirect(url_for("index"))

    if request.method == "POST":
        username = (request.form.get("username") or "").strip()
        password = request.form.get("password") or ""
        if username == WEB_USER and check_password_hash(PASSWORD_HASH, password):
            session["logged_in"] = True
            return redirect(url_for("index"))
        flash("Usuário ou senha inválidos.", "error")

    return render_template("login.html")


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/")
@login_required
def index():
    return render_template("index.html")


@app.route("/api/state")
@login_required
def api_state():
    return jsonify(build_snapshot())


@app.route("/api/history")
@login_required
def api_history():
    topic = request.args.get("topic", "")
    if not topic.startswith(f"{MQTT_ROOT_TOPIC}/"):
        return jsonify({"ok": False, "error": "topic invalido"}), 400
    try:
        limit = min(max(int(request.args.get("limit", 120)), 1), 2000)
    except ValueError:
        limit = 120
    try:
        since = float(request.args.get("since", 0) or 0)
    except ValueError:
        since = 0
    points = db.get_history(topic, limit=limit, since=since)
    return jsonify({"ok": True, "topic": topic, "points": points})


@app.route("/api/events")
@login_required
def api_events():
    try:
        limit = min(max(int(request.args.get("limit", 50)), 1), 500)
    except ValueError:
        limit = 50
    try:
        since = float(request.args.get("since", 0) or 0)
    except ValueError:
        since = 0
    events = db.get_events(limit=limit, since=since)
    return jsonify({"ok": True, "events": events})


@app.route("/api/stream")
@login_required
def api_stream():
    sub = queue.Queue(maxsize=64)
    with subscribers_lock:
        subscribers.add(sub)

    def generate():
        try:
            yield f"event: snapshot\ndata: {json.dumps(build_snapshot())}\n\n"
            while True:
                try:
                    payload = sub.get(timeout=SSE_KEEPALIVE)
                    yield f"data: {payload}\n\n"
                except queue.Empty:
                    yield f"event: meta\ndata: {json.dumps({'online': get_online()})}\n\n"
        finally:
            with subscribers_lock:
                subscribers.discard(sub)

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.route("/api/command", methods=["POST"])
@login_required
def api_command():
    data = request.get_json(silent=True) or {}
    topic = data.get("topic")
    value = data.get("value")

    if not isinstance(topic, str) or not topic.endswith("/command"):
        return jsonify({"ok": False, "error": "topico invalido"}), 400
    if not topic.startswith(f"{MQTT_ROOT_TOPIC}/"):
        return jsonify({"ok": False, "error": "topico fora do root"}), 400
    if not isinstance(value, bool):
        return jsonify({"ok": False, "error": "valor invalido"}), 400

    client.publish(topic, json.dumps(value), qos=1)
    db.record_event(topic, value, "command")
    return jsonify({"ok": True})


if __name__ == "__main__":
    start_mqtt()
    app.run(host=WEB_HOST, port=WEB_PORT, debug=False, use_reloader=False)