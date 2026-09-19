import argparse
import json
import math
import os
import random
import time

import paho.mqtt.client as mqtt

ROOT = "maquete_inteligente"

LIGHT_OFF_THRESHOLD = 50.0
LIGHT_ON_THRESHOLD = 20.0
MANUAL_OVERRIDE_DURATION = 60000
MOTION_LIGHT_TIMEOUT = 30000
GATE_CLOSE_DELAY = 30000
DOOR_OPEN_ANGLE = 90
GATE_OPEN_POSITION = 50
GATE_CLOSE_POSITION = 0
TEST_FUMACA_MS = 10000
TEST_HALL_CLOSE_MS = 8000
TEST_MOTION_MS = 4000

TICK_MS = 1000
HEARTBEAT_INTERVAL = 30000
SMOKE_EVENT_INTERVAL = 45000
SMOKE_RISE_PER_TICK = 8.0
SMOKE_DECAY_PER_TICK = 6.0
SMOKE_ALERT_THRESHOLD = 30.0
ROOMS = ["sala", "quarto", "banheiro", "cozinha", "escritorio", "garagem"]
MOTION_SENSORS = ["sala", "garagem", "patio"]

BASE_TEMPERATURE = {
    "sala": (24.0, 27.0),
    "quarto": (22.0, 25.0),
}
BASE_HUMIDITY = {
    "sala": (50.0, 60.0),
    "quarto": (45.0, 55.0),
}
BASE_LUMINOSITY = {
    "sala": (8.0, 75.0),
    "quarto": (15.0, 70.0),
    "banheiro": (40.0, 60.0),
    "cozinha": (35.0, 55.0),
    "escritorio": (30.0, 70.0),
    "garagem": (5.0, 60.0),
}

state = {}
last_state = {}
last_publish = {}

gate_target = GATE_CLOSE_POSITION
gate_close_at = 0
door_target = 0
smoke_event_phase = "idle"
smoke_event_remaining_ticks = 0
next_smoke_event_ms = 8000
next_hall_event_ms = 15000
motion_until = {sensor: 0 for sensor in MOTION_SENSORS}
last_motion = {sensor: 0 for sensor in MOTION_SENSORS}
manual_until = {
    **{f"{room}/led": 0 for room in ROOMS},
    "cozinha/exaustor": 0,
}
hall_until = 0
test_until = {}
test_force_alarm = False


def full_topic(suffix):
    return f"{ROOT}/{suffix}"


def round_float(value):
    return round(value, 1)


def publish(suffix, value, retain=True):
    topic = full_topic(suffix)
    payload = json.dumps(value)
    client.publish(topic, payload, retain=retain)
    print(f"Publicado tópico={topic} mensagem={value}")
    last_state[suffix] = value


def publish_changed(suffix, value, retain=True, tolerance=0.0):
    if isinstance(value, float):
        value = round_float(value)
    current = last_state.get(suffix)
    if isinstance(current, float):
        current = round_float(current)
    if current == value:
        return
    if isinstance(value, float) and current is not None and abs(value - current) < tolerance:
        return
    publish(suffix, value, retain=retain)


def publish_all():
    for suffix, value in state.items():
        publish(suffix, value)


def on_connect(client, userdata, flags, reason_code, properties=None):
    client.subscribe(f"{ROOT}/+/+/command")
    client.publish(f"{ROOT}/status/online", json.dumps(True), retain=True)
    print(f"Inscrito no tópico: {ROOT}/+/+/command")


def parse_boolean(value):
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized == "true":
            return True
        if normalized == "false":
            return False
    return value


def on_message(client, userdata, msg):
    global door_target, gate_target, gate_close_at, test_force_alarm, hall_until
    try:
        value = parse_boolean(json.loads(msg.payload.decode("utf-8")))
    except (json.JSONDecodeError, UnicodeDecodeError):
        value = msg.payload.decode("utf-8", errors="ignore")

    now = time.time() * 1000
    parts = msg.topic.split("/")
    if len(parts) < 3 or parts[-1] != "command":
        return

    component = parts[-2]
    room = parts[-3]

    if component == "led":
        suffix = f"{room}/led/state"
        state[suffix] = bool(value)
        manual_until[f"{room}/led"] = now + MANUAL_OVERRIDE_DURATION
        publish_changed(suffix, state[suffix])
        print(f"Comando recebido: {msg.topic} -> luz do {room} {'ligada' if value else 'desligada'}")
    elif room == "cozinha" and component == "exaustor":
        suffix = "cozinha/exaustor/state"
        state[suffix] = bool(value)
        manual_until["cozinha/exaustor"] = now + MANUAL_OVERRIDE_DURATION
        publish_changed(suffix, state[suffix])
        print(f"Comando recebido: {msg.topic} -> exaustor {'ligado' if value else 'desligado'}")
    elif room == "sala" and component == "porta":
        door_target = DOOR_OPEN_ANGLE if value else 0
        print(f"Comando recebido: {msg.topic} -> porta {'abrindo' if value else 'fechando'}")
    elif room == "garagem" and component == "portao":
        gate_close_at = 0
        gate_target = GATE_OPEN_POSITION if value else GATE_CLOSE_POSITION
        print(f"Comando recebido: {msg.topic} -> portão {'abrindo' if value else 'fechando'}")
    elif room == "principal" and component == "alarme":
        suffix = "principal/alarme/state"
        state[suffix] = bool(value)
        publish_changed(suffix, state[suffix])
        if not value:
            test_force_alarm = False
            state["principal/alarme/triggered"] = False
            state["principal/buzzer/state"] = False
            publish_changed("principal/alarme/triggered", False)
            publish_changed("principal/buzzer/state", False)
        print(f"Comando recebido: {msg.topic} -> alarme {'armado' if value else 'desarmado'}")
    elif room == "principal" and component == "ferias":
        suffix = "principal/ferias/state"
        state[suffix] = bool(value)
        publish_changed(suffix, state[suffix])
        print(f"Comando recebido: {msg.topic} -> modo férias {'ligado' if value else 'desligado'}")
    elif room == "test":
        if component == "fumaca" and value:
            test_until["fumaca"] = now + TEST_FUMACA_MS
            state["cozinha/fumaca/percentage"] = 75.0
            state["cozinha/fumaca/state"] = True
            print(f"Comando recebido: {msg.topic} -> fumaça de teste ligada (10s)")
        elif component == "fumaca" and not value:
            test_until.pop("fumaca", None)
            state["cozinha/fumaca/percentage"] = 0.0
            state["cozinha/fumaca/state"] = False
        elif component == "movimento" and value:
            for sensor in MOTION_SENSORS:
                state[f"{sensor}/movimento/state"] = True
                motion_until[sensor] = now + TEST_MOTION_MS
                last_motion[sensor] = now
            print(f"Comando recebido: {msg.topic} -> movimento de teste em todos os sensores")
        elif component == "movimento" and not value:
            for sensor in MOTION_SENSORS:
                state[f"{sensor}/movimento/state"] = False
                motion_until[sensor] = 0
        elif component == "alarme" and value:
            test_force_alarm = True
            state["principal/alarme/triggered"] = True
            state["principal/buzzer/state"] = True
            print(f"Comando recebido: {msg.topic} -> alarme de teste disparado")
        elif component == "alarme" and not value:
            test_force_alarm = False
            state["principal/alarme/triggered"] = False
            state["principal/buzzer/state"] = False
        elif component == "hall" and value:
            state["garagem/hall/state"] = True
            hall_until = now + 1500
            gate_target = GATE_OPEN_POSITION
            gate_close_at = now + TEST_HALL_CLOSE_MS
            print(f"Comando recebido: {msg.topic} -> carro de teste no portão")
        elif component == "hall" and not value:
            state["garagem/hall/state"] = False
            hall_until = 0
            gate_target = GATE_CLOSE_POSITION
            gate_close_at = 0


def animate(value, target, step):
    if value < target:
        return min(value + step, target)
    if value > target:
        return max(value - step, target)
    return value


def light_rule(room, luminosity, now):
    if now < manual_until.get(f"{room}/led", 0):
        return
    suffix = f"{room}/led/state"
    motion_active = room in last_motion and last_motion[room] != 0 and (now - last_motion[room]) < MOTION_LIGHT_TIMEOUT
    if luminosity > LIGHT_OFF_THRESHOLD and not motion_active:
        state[suffix] = False
    elif luminosity < LIGHT_ON_THRESHOLD or motion_active:
        state[suffix] = True


def update_dht(room, suffix, now):
    base_min, base_max = BASE_TEMPERATURE[room]
    temperature = base_min + (base_max - base_min) / 2 \
        + (base_max - base_min) / 2 * math.sin(now / 12000.0 + len(room))
    humidity_min, humidity_max = BASE_HUMIDITY[room]
    humidity = humidity_min + (humidity_max - humidity_min) / 2 \
        + (humidity_max - humidity_min) / 2 * math.sin(now / 15000.0 + len(room) * 2)
    state[f"{suffix}/temperature"] = round_float(temperature)
    state[f"{suffix}/humidity"] = round_float(humidity)


def update_luminosity(room, now):
    min_val, max_val = BASE_LUMINOSITY[room]
    mid = (min_val + max_val) / 2
    amplitude = (max_val - min_val) / 2
    period = [60000, 80000, 120000, 100000, 150000, 90000][ROOMS.index(room)]
    luminosity = mid + amplitude * math.sin(now / (period / (2 * math.pi)) + ROOMS.index(room))
    state[f"{room}/ldr/luminosity"] = round_float(luminosity)


def update_motion(now):
    for sensor in MOTION_SENSORS:
        if now < motion_until[sensor]:
            continue
        if state[f"{sensor}/movimento/state"]:
            state[f"{sensor}/movimento/state"] = False
        elif random.random() < 0.03:
            state[f"{sensor}/movimento/state"] = True
            motion_until[sensor] = now + random.randint(5000, 8000)
            last_motion[sensor] = now


def update_smoke_and_exaustor(now):
    global smoke_event_phase, smoke_event_remaining_ticks, next_smoke_event_ms
    percentage = float(state["cozinha/fumaca/percentage"])

    if smoke_event_phase == "idle":
        if now >= next_smoke_event_ms:
            smoke_event_phase = "rising"
            smoke_event_remaining_ticks = 10
    elif smoke_event_phase == "rising":
        percentage = min(percentage + SMOKE_RISE_PER_TICK, 75.0)
        smoke_event_remaining_ticks -= 1
        if smoke_event_remaining_ticks <= 0 or percentage >= 75.0:
            smoke_event_phase = "decaying"
            smoke_event_remaining_ticks = 12
    elif smoke_event_phase == "decaying":
        percentage = max(percentage - SMOKE_DECAY_PER_TICK, 0.0)
        smoke_event_remaining_ticks -= 1
        if smoke_event_remaining_ticks <= 0 or percentage <= 0.0:
            smoke_event_phase = "idle"
            smoke_event_remaining_ticks = 0
            next_smoke_event_ms = now + SMOKE_EVENT_INTERVAL

    state["cozinha/fumaca/percentage"] = round_float(percentage)
    state["cozinha/fumaca/state"] = percentage > SMOKE_ALERT_THRESHOLD

    auto_exaustor = now >= manual_until.get("cozinha/exaustor", 0)
    if auto_exaustor:
        state["cozinha/exaustor/state"] = state["cozinha/fumaca/state"]


def update_gate_and_door(now):
    global gate_target, gate_close_at, door_target, hall_until, next_hall_event_ms

    if hall_until and now >= hall_until:
        hall_until = 0
        state["garagem/hall/state"] = False

    if now >= next_hall_event_ms and gate_target == GATE_CLOSE_POSITION \
            and state["garagem/portao/position"] == GATE_CLOSE_POSITION:
        state["garagem/hall/state"] = True
        hall_until = now + 1500
        gate_target = GATE_OPEN_POSITION
        gate_close_at = now + GATE_CLOSE_DELAY
        next_hall_event_ms = now + random.randint(60000, 120000)

    position = int(state["garagem/portao/position"])
    position = animate(position, gate_target, 5)
    state["garagem/portao/position"] = position
    state["garagem/portao/state"] = position > GATE_OPEN_POSITION / 2

    if gate_close_at != 0 and now >= gate_close_at and position >= GATE_OPEN_POSITION:
        gate_close_at = 0
        gate_target = GATE_CLOSE_POSITION

    angle = int(state["sala/porta/servo_angle"])
    angle = animate(angle, door_target, 9)
    state["sala/porta/servo_angle"] = angle
    state["sala/porta/state"] = angle >= DOOR_OPEN_ANGLE / 2


def update_alarm_and_buzzer(now):
    armed = state["principal/alarme/state"]
    if not armed and not test_force_alarm:
        state["principal/alarme/triggered"] = False
        state["principal/buzzer/state"] = False
        return

    intrusion = any(state[f"{sensor}/movimento/state"] for sensor in MOTION_SENSORS)
    if intrusion:
        state["principal/alarme/triggered"] = True

    if state["principal/alarme/triggered"]:
        state["principal/buzzer/state"] = True


def update_ferias(now):
    if not state["principal/ferias/state"]:
        return
    bucket = int(now // 60000)
    for room in ROOMS:
        if now < manual_until.get(f"{room}/led", 0):
            continue
        seed = ROOMS.index(room) * 40503
        h = (bucket * 2654435761 + seed) & 0xFFFF
        state[f"{room}/led/state"] = bool((h >> 7) & 1)


def update_test_timers(now):
    if "fumaca" in test_until and now >= test_until["fumaca"]:
        del test_until["fumaca"]
        state["cozinha/fumaca/percentage"] = 0.0
        state["cozinha/fumaca/state"] = False
        print("Fumaça de teste desligada automaticamente")


def init_state():
    for room in ROOMS:
        state[f"{room}/led/state"] = False
        state[f"{room}/ldr/luminosity"] = 40.0
    for room in ["sala", "quarto"]:
        state[f"{room}/dht11/temperature"] = 24.0
        state[f"{room}/dht11/humidity"] = 50.0
    state["sala/porta/state"] = False
    state["sala/porta/servo_angle"] = 0
    state["cozinha/fumaca/state"] = False
    state["cozinha/fumaca/percentage"] = 0.0
    state["cozinha/exaustor/state"] = False
    state["garagem/portao/state"] = False
    state["garagem/portao/position"] = 0
    state["garagem/hall/state"] = False
    for sensor in MOTION_SENSORS:
        state[f"{sensor}/movimento/state"] = False
    state["principal/alarme/state"] = False
    state["principal/alarme/triggered"] = False
    state["principal/buzzer/state"] = False
    state["principal/ferias/state"] = False


def main(args):
    global client

    init_state()

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2) \
        if hasattr(mqtt, "CallbackAPIVersion") else mqtt.Client()

    if args.username and args.password:
        client.username_pw_set(args.username, args.password)

    client.will_set(full_topic("status/online"), json.dumps(False), qos=1, retain=True)

    try:
        client.connect(args.broker, args.port)
    except Exception as e:
        print(f"Erro ao conectar MQTT: {e}. Tentando novamente em 5s...")
        time.sleep(5)
        client.connect(args.broker, args.port)

    client.on_connect = on_connect
    client.on_message = on_message
    client.loop_start()

    publish_all()

    tick_ms = args.interval * 1000
    heartbeat_ms = args.heartbeat * 1000
    last_heartbeat = 0
    last_tick = 0

    try:
        while True:
            now = time.time() * 1000

            if now - last_tick >= tick_ms:
                last_tick = now
                update_dht("sala", "sala/dht11", now)
                update_dht("quarto", "quarto/dht11", now)
                for room in ROOMS:
                    update_luminosity(room, now)
                    light_rule(room, float(state[f"{room}/ldr/luminosity"]), now)
                update_motion(now)
                update_smoke_and_exaustor(now)
                update_gate_and_door(now)
                update_alarm_and_buzzer(now)
                update_ferias(now)
                update_test_timers(now)

                for suffix, value in state.items():
                    publish_changed(suffix, value)
                publish_changed("cozinha/fumaca/percentage", state["cozinha/fumaca/percentage"])

            if now - last_heartbeat >= heartbeat_ms:
                last_heartbeat = now
                publish("status/online", True, retain=True)

            time.sleep(0.05)
    except KeyboardInterrupt:
        print("\nEncerrando...")
    finally:
        try:
            publish("status/online", False, retain=True)
        except Exception:
            pass
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Simulador de Arduino para a Maquete Inteligente via MQTT")
    parser.add_argument("--broker", default=os.getenv("MQTT_BROKER", "broker.mqtt.cool"))
    parser.add_argument("--port", type=int, default=int(os.getenv("MQTT_PORT", 1883)))
    parser.add_argument("--username", default=os.getenv("MQTT_USERNAME"), help="usuário MQTT (opcional)")
    parser.add_argument("--password", default=os.getenv("MQTT_PASSWORD"), help="senha MQTT (opcional)")
    parser.add_argument("--interval", type=float, default=1.0, help="intervalo do tick de simulação (s)")
    parser.add_argument("--heartbeat", type=int, default=30, help="intervalo do heartbeat (s)")
    main(parser.parse_args())