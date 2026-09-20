import json
import os
import time
from collections import deque

import serial
import serial.tools.list_ports
import paho.mqtt.client as mqtt

SERIAL_BAUDRATE = 9600

MQTT_ROOT_TOPIC = "maquete_inteligente"
HEARTBEAT_TOPIC = f"{MQTT_ROOT_TOPIC}/status/online"

MQTT_BROKER = os.getenv("MQTT_BROKER", "broker.mqtt.cool")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_USERNAME = os.getenv("MQTT_USERNAME") or None
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD") or None

ARDUINO_PORT = os.getenv("ARDUINO_PORT")
ARDUINO_VID = os.getenv("ARDUINO_VID")
ARDUINO_PID = os.getenv("ARDUINO_PID")

KNOWN_VID_PID = {
    (0x2341, 0x0042),
    (0x2341, 0x0043),
    (0x2341, 0x0243),
    (0x1A86, 0x7523),
}


def detect_arduino_port():
    if ARDUINO_PORT:
        return ARDUINO_PORT

    known = set(KNOWN_VID_PID)
    try:
        if ARDUINO_VID and ARDUINO_PID:
            known.add((int(ARDUINO_VID, 16), int(ARDUINO_PID, 16)))
    except ValueError:
        pass

    for port in serial.tools.list_ports.comports():
        if port.vid is not None and port.pid is not None and (port.vid, port.pid) in known:
            return port.device
    for port in serial.tools.list_ports.comports():
        if "Arduino" in port.description or "USB" in port.description:
            return port.device
    return None


def connect_mqtt():
    try:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="maquete-script")
    except AttributeError:
        client = mqtt.Client(client_id="maquete-script")
    client.clean_session = False
    if MQTT_USERNAME and MQTT_PASSWORD:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    client.on_connect = on_connect
    client.will_set(HEARTBEAT_TOPIC, json.dumps(False), qos=1, retain=True)
    while True:
        try:
            client.connect(MQTT_BROKER, MQTT_PORT)
            client.loop_start()
            print(f"Conectado ao broker MQTT: {MQTT_BROKER}:{MQTT_PORT}")
            return client
        except Exception as e:
            print(f"Erro ao conectar MQTT: {e}. Tentando novamente em 5s...")
            time.sleep(5)


def connect_serial():
    while True:
        port = detect_arduino_port()
        if port:
            try:
                ser = serial.Serial(port, SERIAL_BAUDRATE, timeout=1)
                print(f"Conectado à porta serial: {port} ({SERIAL_BAUDRATE} baud)")
                return ser
            except serial.SerialException as e:
                print(f"Erro ao conectar na porta {port}: {e}. Tentando novamente em 5s...")
        else:
            print("Nenhuma porta Arduino encontrada. Buscando novamente em 5s...")
        time.sleep(5)


def on_connect(client, userdata, flags, reason_code, properties=None):
    client.subscribe(f"{MQTT_ROOT_TOPIC}/#")
    client.publish(HEARTBEAT_TOPIC, json.dumps(True), retain=True)
    print(f"Inscrito no tópico: {MQTT_ROOT_TOPIC}/#")


def parse_boolean(value):
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized == "true":
            return True
        if normalized == "false":
            return False
    return value


class PendingCommandQueue:
    def __init__(self):
        self._queue = deque()

    def enqueue(self, command):
        self._queue.append(command)

    def flush(self, write):
        while self._queue:
            pending = self._queue.popleft()
            if not write(pending):
                self._queue.appendleft(pending)
                return

    def __bool__(self):
        return bool(self._queue)


def main():
    client = connect_mqtt()
    ser = connect_serial()
    state = {"ser": ser, "pending_commands": PendingCommandQueue()}

    def send_serial(command):
        try:
            state["ser"].write((json.dumps(command) + "\n").encode("utf-8"))
            topic = next(iter(command))
            print(f"Enviado para serial tópico={topic} mensagem={command[topic]}")
            return True
        except serial.SerialException as e:
            print(f"Erro ao escrever na serial: {e}. Comando guardado para reconexão.")
            state["pending_commands"].enqueue(command)
            return False

    def flush_pending():
        def try_write(command):
            try:
                state["ser"].write((json.dumps(command) + "\n").encode("utf-8"))
                print(f"Comando pendente enviado após reconexão: {command}")
                return True
            except serial.SerialException:
                return False

        if not state["pending_commands"].flush(try_write):
            print("Falha ao enviar comando pendente. Devolvendo ao início da fila.")

    def on_message(client, userdata, msg):
        topic = msg.topic
        if not topic.endswith("/command"):
            return

        payload = msg.payload.decode("utf-8")
        try:
            message = json.loads(payload)
        except json.JSONDecodeError:
            message = payload

        message = parse_boolean(message)
        send_serial({topic: message})

    client.on_message = on_message

    try:
        while True:
            try:
                line = ser.readline().decode("utf-8", errors="ignore").strip()
                if not line:
                    continue

                data = json.loads(line)
                topic = next(iter(data))
                message = parse_boolean(data[topic])
                client.publish(topic, json.dumps(message), retain=True)
                print(f"Publicado tópico={topic} mensagem={message}")
            except json.JSONDecodeError:
                print(f"Ignorando linha inválida: {line}")
            except (IndexError, KeyError):
                print(f"JSON sem tópico/mensagem: {line}")
            except serial.SerialException:
                print("Conexão serial perdida. Reconectando...")
                ser.close()
                ser = connect_serial()
                state["ser"] = ser
                flush_pending()
    except KeyboardInterrupt:
        print("\nEncerrando...")
    finally:
        try:
            client.publish(HEARTBEAT_TOPIC, json.dumps(False), retain=True)
        except Exception:
            pass
        client.loop_stop()
        client.disconnect()
        ser.close()


if __name__ == "__main__":
    main()