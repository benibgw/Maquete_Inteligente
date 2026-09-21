import csv
import io
import json
import os
import queue
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
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
SCHEDULER_POLL = float(os.getenv("SCHEDULER_POLL", 20.0))

WEATHER_LAT = os.getenv("WEATHER_LAT", "-29.6839")
WEATHER_LON = os.getenv("WEATHER_LON", "-53.8069")
WEATHER_CACHE_TTL = float(os.getenv("WEATHER_CACHE_TTL", 600))
WEATHER_URL = (
    f"https://api.open-meteo.com/v1/forecast?"
    f"latitude={urllib.parse.quote(WEATHER_LAT)}&longitude={urllib.parse.quote(WEATHER_LON)}"
    f"&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m"
    f"&timezone=auto"
)
_weather_cache = {"ts": 0.0, "data": None}

OPEN_METEO_CODES = {
    0: "Céu limpo",
    1: "Predom. claro",
    2: "Parcial. nublado",
    3: "Nublado",
    45: "Nevoeiro",
    48: "Nevoeiro",
    51: "Garoa leve",
    53: "Garoa",
    55: "Garoa forte",
    61: "Chuva fraca",
    63: "Chuva",
    65: "Chuva forte",
    66: "Chuva congelante",
    67: "Chuva congelante",
    71: "Neve fraca",
    73: "Neve",
    75: "Neve forte",
    80: "Pancada chuva",
    81: "Pancada chuva",
    82: "Pancada forte",
    95: "Trovoada",
    96: "Trovoada granizo",
    99: "Trovoada granizo",
}

SCENE_COMMAND_DELAY = 0.15

SCENES = {
    "sair": [
        ((f"{MQTT_ROOT_TOPIC}/sala/led/command"), False),
        ((f"{MQTT_ROOT_TOPIC}/quarto/led/command"), False),
        ((f"{MQTT_ROOT_TOPIC}/banheiro/led/command"), False),
        ((f"{MQTT_ROOT_TOPIC}/cozinha/led/command"), False),
        ((f"{MQTT_ROOT_TOPIC}/escritorio/led/command"), False),
        ((f"{MQTT_ROOT_TOPIC}/garagem/led/command"), False),
        ((f"{MQTT_ROOT_TOPIC}/cozinha/exaustor/command"), False),
        ((f"{MQTT_ROOT_TOPIC}/sala/porta/command"), False),
        ((f"{MQTT_ROOT_TOPIC}/garagem/portao/command"), False),
        ((f"{MQTT_ROOT_TOPIC}/principal/alarme/command"), True),
    ],
    "chegar": [
        ((f"{MQTT_ROOT_TOPIC}/principal/alarme/command"), False),
        ((f"{MQTT_ROOT_TOPIC}/garagem/portao/command"), True),
        ((f"{MQTT_ROOT_TOPIC}/sala/led/command"), True),
    ],
}

VALID_COMMAND_TOPICS = {
    f"{MQTT_ROOT_TOPIC}/sala/led/command",
    f"{MQTT_ROOT_TOPIC}/quarto/led/command",
    f"{MQTT_ROOT_TOPIC}/banheiro/led/command",
    f"{MQTT_ROOT_TOPIC}/cozinha/led/command",
    f"{MQTT_ROOT_TOPIC}/escritorio/led/command",
    f"{MQTT_ROOT_TOPIC}/garagem/led/command",
    f"{MQTT_ROOT_TOPIC}/cozinha/exaustor/command",
    f"{MQTT_ROOT_TOPIC}/sala/porta/command",
    f"{MQTT_ROOT_TOPIC}/garagem/portao/command",
    f"{MQTT_ROOT_TOPIC}/principal/alarme/command",
    f"{MQTT_ROOT_TOPIC}/principal/ferias/command",
}

app = Flask(__name__)
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.secret_key = SECRET_KEY

PASSWORD_HASH = generate_password_hash(WEB_PASSWORD)

state_lock = threading.Lock()
state = {}
last_heartbeat = 0.0
_mqtt_connected = False
START_TIME = time.time()

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


def on_disconnect(client, userdata, flags, reason_code, properties=None):
    global _mqtt_connected
    _mqtt_connected = False


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
    global _mqtt_connected
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect
    while True:
        try:
            client.connect(MQTT_BROKER, MQTT_PORT)
            _mqtt_connected = True
            print(f"Conectado ao broker MQTT: {MQTT_BROKER}:{MQTT_PORT}")
            client.loop_forever()
        except Exception as error:
            _mqtt_connected = False
            print(f"Erro MQTT: {error}. Reconectando em 5s...")
            time.sleep(5)


def start_mqtt():
    thread = threading.Thread(target=mqtt_worker, daemon=True)
    thread.start()


def scheduler_worker():
    while True:
        try:
            now = time.localtime()
            today = time.strftime("%Y-%m-%d", now)
            now_hhmm = f"{now.tm_hour:02d}:{now.tm_min:02d}"
            for schedule in db.list_schedules():
                if not schedule["enabled"]:
                    continue
                if schedule["last_run_date"] == today:
                    continue
                if schedule["time"] <= now_hhmm:
                    topic = schedule["topic"]
                    value = schedule["value"]
                    try:
                        client.publish(topic, json.dumps(value), qos=1)
                        db.record_event(topic, value, "command")
                        print(f"Agendamento executado: {schedule['label']}")
                    except Exception as error:
                        print(f"Erro no agendamento {schedule['id']}: {error}")
                    db.update_schedule(schedule["id"], last_run_date=today)
        except Exception as error:
            print(f"Erro no scheduler: {error}")
        time.sleep(SCHEDULER_POLL)


def start_scheduler():
    threading.Thread(target=scheduler_worker, daemon=True).start()


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


@app.route("/api/health")
def api_health():
    db_ok = True
    try:
        db.get_conn().execute("SELECT 1").fetchone()
    except Exception:
        db_ok = False
    return jsonify(
        {
            "ok": True,
            "status": "up",
            "uptime": time.time() - START_TIME,
            "mqtt": _mqtt_connected,
            "online": get_online(),
            "db": db_ok,
        }
    )


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


@app.route("/api/topics")
@login_required
def api_topics():
    return jsonify({"ok": True, "topics": db.list_numeric_topics()})


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


@app.route("/api/scene", methods=["POST"])
@login_required
def api_scene():
    data = request.get_json(silent=True) or {}
    name = data.get("scene")
    if name not in SCENES:
        return jsonify({"ok": False, "error": f"cena invalida: {name}"}), 400

    def run():
        for topic, value in SCENES[name]:
            client.publish(topic, json.dumps(value), qos=1)
            db.record_event(topic, value, "command")
            time.sleep(SCENE_COMMAND_DELAY)

    threading.Thread(target=run, daemon=True).start()
    return jsonify({"ok": True, "scene": name})


@app.route("/api/schedules", methods=["GET", "POST"])
@login_required
def api_schedules():
    if request.method == "GET":
        return jsonify({"ok": True, "schedules": db.list_schedules()})

    data = request.get_json(silent=True) or {}
    label = (data.get("label") or "").strip()
    time_str = data.get("time")
    topic = data.get("topic")
    value = data.get("value")

    if not label:
        return jsonify({"ok": False, "error": "label obrigatorio"}), 400
    try:
        time.strptime(time_str, "%H:%M")
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": "hora invalida (use HH:MM)"}), 400
    if topic not in VALID_COMMAND_TOPICS:
        return jsonify({"ok": False, "error": "topico invalido"}), 400
    if not isinstance(value, bool):
        return jsonify({"ok": False, "error": "valor invalido"}), 400

    schedule_id = db.add_schedule(label, time_str, topic, value)
    if schedule_id is None:
        return jsonify({"ok": False, "error": "falha ao salvar"}), 500
    return jsonify({"ok": True, "id": schedule_id})


@app.route("/api/schedules/<int:schedule_id>", methods=["PATCH", "DELETE"])
@login_required
def api_schedule_item(schedule_id):
    if request.method == "DELETE":
        ok = db.delete_schedule(schedule_id)
        if not ok:
            return jsonify({"ok": False, "error": "falha ao excluir"}), 500
        return jsonify({"ok": True})

    data = request.get_json(silent=True) or {}
    fields = {}
    if "label" in data:
        label = (data.get("label") or "").strip()
        if not label:
            return jsonify({"ok": False, "error": "label obrigatorio"}), 400
        fields["label"] = label
    if "time" in data:
        time_str = data.get("time")
        try:
            time.strptime(time_str, "%H:%M")
        except (TypeError, ValueError):
            return jsonify({"ok": False, "error": "hora invalida (use HH:MM)"}), 400
        fields["time"] = time_str
    if "topic" in data:
        if data["topic"] not in VALID_COMMAND_TOPICS:
            return jsonify({"ok": False, "error": "topico invalido"}), 400
        fields["topic"] = data["topic"]
    if "value" in data:
        if not isinstance(data["value"], bool):
            return jsonify({"ok": False, "error": "valor invalido"}), 400
        fields["value"] = int(data["value"])
    if "enabled" in data:
        if not isinstance(data["enabled"], bool):
            return jsonify({"ok": False, "error": "enabled invalido"}), 400
        fields["enabled"] = int(data["enabled"])

    ok = db.update_schedule(schedule_id, **fields)
    if not ok:
        return jsonify({"ok": False, "error": "falha ao atualizar"}), 500
    return jsonify({"ok": True})


@app.route("/api/export/events.csv")
@login_required
def api_export_events_csv():
    since = request.args.get("since", 0, type=int)
    since = max(since, 0)
    data = db.get_events(limit=10000, since=float(since))
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow(["ts", "kind", "topic", "value"])
    for row in data:
        writer.writerow([row["ts"], row["kind"], row["topic"], row["value"]])
    content = "\ufeff" + buffer.getvalue()
    return Response(
        content,
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=eventos.csv"},
    )


@app.route("/api/export/readings.csv")
@login_required
def api_export_readings_csv():
    topic_arg = request.args.get("topic")
    if not topic_arg or not topic_arg.startswith(f"{MQTT_ROOT_TOPIC}/"):
        return jsonify({"ok": False, "error": "query topic obrigatoria"}), 400
    since = max(request.args.get("since", 0, type=int), 0)
    data = db.get_history(topic_arg, limit=100000, since=float(since))
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow(["ts", "value"])
    for row in data:
        writer.writerow([row["ts"], row["value"]])
    content = "\ufeff" + buffer.getvalue()
    safe_name = topic_arg.rsplit("/", 1)[0].replace("/", "_")
    return Response(
        content,
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={safe_name}.csv"},
    )


@app.route("/api/summary")
@login_required
def api_summary():
    return jsonify({"ok": True, "summary": db.get_daily_summary()})


def _fetch_weather():
    try:
        with urllib.request.urlopen(WEATHER_URL, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
        current = payload.get("current", {})
        return {
            "temperature": current.get("temperature_2m"),
            "humidity": current.get("relative_humidity_2m"),
            "wind": current.get("wind_speed_10m"),
            "code": current.get("weather_code"),
            "label": OPEN_METEO_CODES.get(current.get("weather_code"), "Desconhecido"),
        }
    except (urllib.error.URLError, OSError, ValueError, KeyError) as error:
        print(f"Erro ao consultar clima: {error}")
        return None


@app.route("/api/weather")
@login_required
def api_weather():
    now = time.time()
    if now - _weather_cache["ts"] < WEATHER_CACHE_TTL and _weather_cache["data"] is not None:
        data = _weather_cache["data"]
    else:
        data = _fetch_weather()
        if data is not None:
            _weather_cache["ts"] = now
            _weather_cache["data"] = data
    if data is None:
        return jsonify({"ok": False})
    return jsonify({"ok": True, "weather": data})


if __name__ == "__main__":
    start_mqtt()
    db.start_prune_thread()
    start_scheduler()
    app.run(host=WEB_HOST, port=WEB_PORT, debug=False, use_reloader=False)