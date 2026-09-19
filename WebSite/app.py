import json
import os
import queue
import threading
import time

import paho.mqtt.client as mqtt
from flask import Flask, Response, jsonify, render_template, request, stream_with_context

MQTT_BROKER = os.getenv("MQTT_BROKER", "broker.mqtt.cool")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_USERNAME = os.getenv("MQTT_USERNAME") or None
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD") or None
MQTT_ROOT_TOPIC = "maquete_inteligente"
STATUS_TOPIC = f"{MQTT_ROOT_TOPIC}/status/online"
ONLINE_TIMEOUT = float(os.getenv("ONLINE_TIMEOUT", 40.0))

WEB_HOST = os.getenv("WEB_HOST", "0.0.0.0")
WEB_PORT = int(os.getenv("WEB_PORT", 5000))

SSE_KEEPALIVE = 5.0

app = Flask(__name__)
app.config["TEMPLATES_AUTO_RELOAD"] = True

state_lock = threading.Lock()
state = {}
last_heartbeat = 0.0

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
    try:
        value = json.loads(msg.payload.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        value = msg.payload.decode("utf-8", errors="ignore")

    with state_lock:
        state[msg.topic] = value
        if msg.topic == STATUS_TOPIC and value is True:
            last_heartbeat = time.time()

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


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/state")
def api_state():
    return jsonify(build_snapshot())


@app.route("/api/stream")
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
    return jsonify({"ok": True})


if __name__ == "__main__":
    start_mqtt()
    app.run(host=WEB_HOST, port=WEB_PORT, debug=False, use_reloader=False)