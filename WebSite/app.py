import json
import threading
import time

import paho.mqtt.client as mqtt
from flask import Flask, jsonify, render_template, request

MQTT_BROKER = "broker.mqtt.cool"
MQTT_PORT = 1883
MQTT_USERNAME = None
MQTT_PASSWORD = None
MQTT_ROOT_TOPIC = "maquete_inteligente"
ONLINE_TIMEOUT = 40.0

WEB_HOST = "0.0.0.0"
WEB_PORT = 5000

app = Flask(__name__)

state_lock = threading.Lock()
state = {}
last_heartbeat = 0.0

try:
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
except AttributeError:
    client = mqtt.Client()

if MQTT_USERNAME and MQTT_PASSWORD:
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)


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
        if msg.topic == f"{MQTT_ROOT_TOPIC}/status/online":
            last_heartbeat = time.time()


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
    now = time.time()
    with state_lock:
        snapshot = dict(state)
        online = (now - last_heartbeat) < ONLINE_TIMEOUT
    return jsonify({"online": online, "state": snapshot})


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

    client.publish(topic, json.dumps(value))
    return jsonify({"ok": True})


if __name__ == "__main__":
    start_mqtt()
    app.run(host=WEB_HOST, port=WEB_PORT, debug=False, use_reloader=False)
