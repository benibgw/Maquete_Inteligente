const ROOT = "maquete_inteligente";
const POLL_MS = 1000;

const ICONS = {
  sala: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v5"/><path d="M2 12a2 2 0 0 0 2-2V9h16v1a2 2 0 0 0 2 2v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-4Z"/><path d="M6 17v1M18 17v1"/></svg>',
  quarto: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>',
  banheiro: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s6 5.2 6 10a6 6 0 0 1-12 0c0-4.8 6-10 6-10Z"/></svg>',
  cozinha: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20"/><path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"/><path d="m4 8 16-4"/><path d="m8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8"/></svg>',
  escritorio: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>',
  garagem: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 16.5V8a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v8.5"/><path d="M3 16.5V11l1.2-3.2A1 1 0 0 1 5.1 7h13.8a1 1 0 0 1 .9.8L21 11v5.5"/><circle cx="7" cy="16.5" r="1.8"/><circle cx="17" cy="16.5" r="1.8"/><path d="M8.8 16.5h6.4"/></svg>',
};

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

function clampPct(v) {
  return Math.max(0, Math.min(100, typeof v === "number" ? v : 0));
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setStatus(id, v, on, off, onClass = "state-on") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = v === true ? on : v === false ? off : "--";
  el.className = "status " + (v === true ? onClass : v === false ? "state-off" : "state-na");
}

function setTriggeredBadge(v) {
  const el = document.getElementById("alarm-triggered-badge");
  if (!el) return;
  if (v === true) {
    el.textContent = "DISPARADO";
    el.className = "status-badge alert";
  } else if (v === false) {
    el.textContent = "NORMAL";
    el.className = "status-badge ok";
  } else {
    el.textContent = "--";
    el.className = "status-badge state-na";
  }
}

function setConnection(online) {
  const el = document.getElementById("connection");
  if (!el) return;
  el.textContent = online ? "online" : "offline";
  el.className = "badge " + (online ? "online" : "offline");
  document.body.classList.toggle("offline", !online);
}

function toggleCardAlert(id, active) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle("card-alert", active);
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

    const icon = document.createElement("div");
    icon.className = "room-icon";
    icon.innerHTML = ICONS[room.key];

    const name = document.createElement("div");
    name.className = "room-name";
    name.textContent = room.label;

    const meterRow = document.createElement("div");
    meterRow.className = "room-meter";

    const meter = document.createElement("div");
    meter.className = "meter";

    const fill = document.createElement("div");
    fill.className = "meter-fill";
    meter.appendChild(fill);

    const text = document.createElement("span");
    text.textContent = "Luz: --";

    meterRow.appendChild(meter);
    meterRow.appendChild(text);

    const toggle = document.createElement("label");
    toggle.className = "toggle";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.setAttribute("aria-label", `Luz da ${room.label}`);

    const track = document.createElement("span");
    track.className = "track";

    toggle.appendChild(checkbox);
    toggle.appendChild(track);

    checkbox.addEventListener("change", () => {
      sendCommand(topic(`${room.key}/led/command`), checkbox.checked);
    });

    card.appendChild(icon);
    card.appendChild(name);
    card.appendChild(meterRow);
    card.appendChild(toggle);
    grid.appendChild(card);

    room.fillEl = fill;
    room.textEl = text;
    room.checkboxEl = checkbox;
  });
}

function updateRooms() {
  ROOMS.forEach((room) => {
    const led = value(`${room.key}/led/state`);
    const lux = value(`${room.key}/ldr/luminosity`);

    room.textEl.textContent = "Luz: " + numberText(lux, 1, " %");
    room.fillEl.style.width = `${clampPct(lux)}%`;
    room.checkboxEl.checked = led === true;
  });
}

function render(data) {
  currentState = data.state || {};
  setConnection(Boolean(data.online));

  setStatus("alarm-state", value("principal/alarme/state"), "ARMADO", "DESARMADO");
  setStatus("alarm-triggered", value("principal/alarme/triggered"), "SIM", "NAO", "state-alert");
  setStatus("buzzer-state", value("principal/buzzer/state"), "LIGADA", "DESLIGADA");
  toggleCardAlert("card-security", value("principal/alarme/triggered") === true);
  setTriggeredBadge(value("principal/alarme/triggered"));

  const smoke = value("cozinha/fumaca/percentage");
  setText("smoke-pct", numberText(smoke, 1, " %"));
  const smokeBar = document.getElementById("smoke-bar");
  if (smokeBar) {
    smokeBar.style.width = `${clampPct(smoke)}%`;
    smokeBar.className =
      "meter-fill " +
      (typeof smoke === "number" ? (smoke >= 60 ? "alert" : smoke >= 30 ? "warn" : "") : "");
  }
  setStatus("smoke-state", value("cozinha/fumaca/state"), "SIM", "NAO", "state-alert");
  setStatus("exhaust-state", value("cozinha/exaustor/state"), "ON", "OFF");
  const exhaustToggle = document.getElementById("exhaust-toggle");
  if (exhaustToggle) exhaustToggle.checked = value("cozinha/exaustor/state") === true;
  toggleCardAlert("card-kitchen", value("cozinha/fumaca/state") === true);

  setStatus("door-state", value("sala/porta/state"), "ABERTA", "FECHADA");
  setText("door-angle", numberText(value("sala/porta/servo_angle"), 0, "°"));
  setStatus("gate-state", value("garagem/portao/state"), "ABERTA", "FECHADA");
  setText("gate-position", numberText(value("garagem/portao/position"), 0, ""));
  setStatus("hall-state", value("garagem/hall/state"), "SIM", "NAO", "state-alert");

  setText(
    "sala-dht",
    dhtText(value("sala/dht11/temperature"), value("sala/dht11/humidity"))
  );
  setText(
    "quarto-dht",
    dhtText(value("quarto/dht11/temperature"), value("quarto/dht11/humidity"))
  );

  setStatus("motion-sala", value("sala/movimento/state"), "SIM", "NAO", "state-alert");
  setStatus("motion-garagem", value("garagem/movimento/state"), "SIM", "NAO", "state-alert");
  setStatus("motion-patio", value("patio/movimento/state"), "SIM", "NAO", "state-alert");

  updateRooms();
}

function bindControls() {
  const bind = (id, topicName, val) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", () => sendCommand(topicName, val));
  };

  bind("alarm-arm", topic("principal/alarme/command"), true);
  bind("alarm-disarm", topic("principal/alarme/command"), false);
  bind("door-open", topic("sala/porta/command"), true);
  bind("door-close", topic("sala/porta/command"), false);
  bind("gate-open", topic("garagem/portao/command"), true);
  bind("gate-close", topic("garagem/portao/command"), false);

  const exhaust = document.getElementById("exhaust-toggle");
  if (exhaust) {
    exhaust.addEventListener("change", () => {
      sendCommand(topic("cozinha/exaustor/command"), exhaust.checked);
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