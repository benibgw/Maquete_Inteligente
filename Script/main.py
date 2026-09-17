import json
import time
import serial
import serial.tools.list_ports
import paho.mqtt.client as mqtt

SERIAL_BAUDRATE = 9600

MQTT_BROKER = "broker.mqtt.cool"
MQTT_PORT = 1883
MQTT_USERNAME = None
MQTT_PASSWORD = None


def detect_arduino_port():
    ports = serial.tools.list_ports.comports()
    for port in ports:
        if "Arduino" in port.description or "USB" in port.description:
            return port.device
    return None


def connect_mqtt():
    client = mqtt.Client()
    if MQTT_USERNAME and MQTT_PASSWORD:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
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


MQTT_ROOT_TOPIC = "maquete_inteligente"


def main():
    client = connect_mqtt()
    ser = connect_serial()
    state = {"ser": ser}

    def on_message(client, userdata, msg):
        topic = msg.topic
        if not topic.endswith("/command"):
            return

        payload = msg.payload.decode("utf-8")
        try:
            message = json.loads(payload)
        except json.JSONDecodeError:
            message = payload

        data = {topic: message}
        try:
            state["ser"].write((json.dumps(data) + "\n").encode("utf-8"))
            print(f"Enviado para serial tópico={topic} mensagem={message}")
        except serial.SerialException as e:
            print(f"Erro ao escrever na serial: {e}")

    client.on_message = on_message
    client.subscribe(f"{MQTT_ROOT_TOPIC}/#")
    print(f"Inscrito no tópico: {MQTT_ROOT_TOPIC}/#")

    try:
        while True:
            try:
                line = ser.readline().decode("utf-8", errors="ignore").strip()
                if not line:
                    continue

                data = json.loads(line)
                topic = data[next(iter(data))]
                message = data[list(data.keys())[1]]
                client.publish(topic, message)
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
    except KeyboardInterrupt:
        print("\nEncerrando...")
    finally:
        client.loop_stop()
        client.disconnect()
        ser.close()


if __name__ == "__main__":
    main()