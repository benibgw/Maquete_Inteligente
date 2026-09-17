const ROOT = "maquete_inteligente";
const POLL_MS = 1000;

const ROOMS = [
  { key: "sala", label: "Sala" },
  { key: "quarto", label: "Quarto" },
  { key: "banheiro", label: "Banheiro" },
  { key: "cozinha", label: "Cozinha" },
  { key: "escritorio", label: "Escritório" },
  { key: "garagem", label: "Garagem" },
];

let currentState = {};

function topic(path) {
  return `${ROOT}/${path}`;
}

function value(path) {
  return currentState[topic(path)];
}

function numberText(v, decimals, suffix) {
  if (typeof v !== "number") return "--";
  return v.toFixed(decimals) + (suffix || "");
}

function dhtText(temp, humi) {
  if (typeof temp !== "number" || typeof humi !== "number") return "--";
  return `${temp.toFixed(1)} °C / ${humi.toFixed(0)} %`;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setBool(id, v, on, off) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = v === true ? on : v === false ? off : "--";
  el.className = v === true ? "state-on" : v === false ? "state-off" : "";
}

function setBoolAlert(id, v, on, off) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = v === true ? on : v === false ? off : "--";
  el.className = v === true ? "state-alert" : v === false ? "state-off" : "";
}

function setBoolOpen(id, v) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = v === true ? "ABERTA" : v === false ? "FECHADA" : "--";
  el.className = v === true ? "state-on" : v === false ? "state-off" : "";
}

function setConnection(online) {
  const el = document.getElementById("connection");
  if (!el) return;
  el.textContent = online ? "online" : "offline";
  el.className = "badge " + (online ? "online" : "offline");
}

async function sendCommand(topicName, val) {
  try {
    await fetch("/api/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: topicName, value: val }),
    });
  } catch (error) {
    console.error("Falha ao enviar comando", error);
  }
}

function buildRooms() {
  const grid = document.getElementById("rooms-grid");
  if (!grid) return;

  ROOMS.forEach((room) => {
    const card = document.createElement("div");
    card.className = "room";

    const name = document.createElement("div");
    name.className = "room-name";
    name.textContent = room.label;

    const lux = document.createElement("div");
    lux.className = "room-lux";
    lux.textContent = "Luz: --";

    const button = document.createElement("button");
    button.className = "led-off";
    button.textContent = "--";
    button.addEventListener("click", () => {
      const path = `${room.key}/led`;
      const ledState = value(`${path}/state`);
      sendCommand(topic(`${path}/command`), !ledState);
    });

    card.appendChild(name);
    card.appendChild(lux);
    card.appendChild(button);
    grid.appendChild(card);

    room.luxEl = lux;
    room.buttonEl = button;
  });
}

function updateRooms() {
  ROOMS.forEach((room) => {
    const led = value(`${room.key}/led/state`);
    const lux = value(`${room.key}/ldr/luminosity`);

    room.luxEl.textContent = "Luz: " + numberText(lux, 1, " %");

    if (led === true) {
      room.buttonEl.textContent = "Desligar";
      room.buttonEl.className = "led-on";
    } else if (led === false) {
      room.buttonEl.textContent = "Ligar";
      room.buttonEl.className = "led-off";
    } else {
      room.buttonEl.textContent = "--";
      room.buttonEl.className = "led-off";
    }
  });
}

function render(data) {
  currentState = data.state || {};
  setConnection(Boolean(data.online));

  setBool("alarm-state", value("principal/alarme/state"), "ARMADO", "DESARMADO");
  setBoolAlert("alarm-triggered", value("principal/alarme/triggered"), "SIM", "NAO");
  setBool("buzzer-state", value("principal/buzzer/state"), "LIGADA", "DESLIGADA");

  setText("smoke-pct", numberText(value("cozinha/fumaca/percentage"), 1, " %"));
  setBoolAlert("smoke-state", value("cozinha/fumaca/state"), "SIM", "NAO");
  setBool("exhaust-state", value("cozinha/exaustor/state"), "ON", "OFF");

  setBoolOpen("door-state", value("sala/porta/state"));
  setText("door-angle", numberText(value("sala/porta/servo_angle"), 0, "°"));
  setBoolOpen("gate-state", value("garagem/portao/state"));
  setText("gate-position", numberText(value("garagem/portao/position"), 0, ""));
  setBoolAlert("hall-state", value("garagem/hall/state"), "SIM", "NAO");

  setText(
    "sala-dht",
    dhtText(value("sala/dht11/temperature"), value("sala/dht11/humidity"))
  );
  setText(
    "quarto-dht",
    dhtText(value("quarto/dht11/temperature"), value("quarto/dht11/humidity"))
  );

  setBoolAlert("motion-sala", value("sala/movimento/state"), "SIM", "NAO");
  setBoolAlert("motion-garagem", value("garagem/movimento/state"), "SIM", "NAO");
  setBoolAlert("motion-patio", value("patio/movimento/state"), "SIM", "NAO");

  updateRooms();
}

function bindControls() {
  const bind = (id, topicName, val) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", () => sendCommand(topicName, val));
  };

  bind("alarm-arm", topic("principal/alarme/command"), true);
  bind("alarm-disarm", topic("principal/alarme/command"), false);
  bind("buzzer-on", topic("principal/buzzer/command"), true);
  bind("buzzer-off", topic("principal/buzzer/command"), false);
  bind("door-open", topic("sala/porta/command"), true);
  bind("door-close", topic("sala/porta/command"), false);
  bind("gate-open", topic("garagem/portao/command"), true);
  bind("gate-close", topic("garagem/portao/command"), false);

  const exhaust = document.getElementById("exhaust-toggle");
  if (exhaust) {
    exhaust.addEventListener("click", () => {
      const state = value("cozinha/exaustor/state");
      sendCommand(topic("cozinha/exaustor/command"), !state);
    });
  }
}

async function refresh() {
  try {
    const response = await fetch("/api/state");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    render(data);
  } catch (error) {
    setConnection(false);
  }
}

buildRooms();
bindControls();
refresh();
setInterval(refresh, POLL_MS);
