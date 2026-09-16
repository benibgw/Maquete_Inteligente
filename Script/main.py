import json
import serial
import serial.tools.list_ports
import paho.mqtt.client as mqtt

SERIAL_PORT = "COM3"
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


def main():
    port = SERIAL_PORT
    if port is None or port == "":
        detected = detect_arduino_port()
        if detected:
            port = detected
            print(f"Porta do Arduino detectada: {port}")
        else:
            print("Nenhuma porta Arduino encontrada. Use SERIAL_PORT para definir.")
            return

    client = mqtt.Client()
    if MQTT_USERNAME and MQTT_PASSWORD:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    client.connect(MQTT_BROKER, MQTT_PORT)
    client.loop_start()
    print(f"Conectado ao broker MQTT: {MQTT_BROKER}:{MQTT_PORT}")

    try:
        ser = serial.Serial(port, SERIAL_BAUDRATE, timeout=1)
        print(f"Lendo da porta serial: {port} ({SERIAL_BAUDRATE} baud)")

        while True:
            line = ser.readline().decode("utf-8", errors="ignore").strip()
            if not line:
                continue

            try:
                data = json.loads(line)
                topic = data[next(iter(data))]
                message = data[list(data.keys())[1]]
                client.publish(topic, message)
                print(f"Publicado tópico={topic} mensagem={message}")
            except json.JSONDecodeError:
                print(f"Ignorando linha inválida: {line}")
            except (IndexError, KeyError):
                print(f"JSON sem tópico/mensagem: {line}")
    except serial.SerialException as e:
        print(f"Erro na porta serial: {e}")
    except KeyboardInterrupt:
        print("\nEncerrando...")
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()