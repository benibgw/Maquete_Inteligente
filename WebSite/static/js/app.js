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

function markSeen() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  setText("last-update", `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
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

async function sendScene(name) {
  try {
    await fetch("/api/scene", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scene: name }),
    });
  } catch (error) {
    console.error("Falha ao executar cena", error);
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
  markSeen();
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
  update3D();

  updateVacationToggle();
  checkAlerts();
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

  const bindScene = (id, name) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", () => sendScene(name));
  };
  bindScene("scene-leave", "sair");
  bindScene("scene-arrive", "chegar");

  const exhaust = document.getElementById("exhaust-toggle");
  if (exhaust) {
    exhaust.addEventListener("change", () => {
      sendCommand(topic("cozinha/exaustor/command"), exhaust.checked);
    });
  }

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await fetch("/logout", { method: "POST" });
      } catch (error) {
        // segue para o login mesmo sem resposta
      }
      window.location.href = "/login";
    });
  }
}

async function refresh() {
  try {
    const response = await fetch("/api/state");
    if (response.status === 401) {
      redirectToLogin();
      return;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    render(data);
  } catch (error) {
    setConnection(false);
  }
}

let authRedirecting = false;

function redirectToLogin() {
  if (authRedirecting) return;
  authRedirecting = true;
  window.location.href = "/login";
}

let liveOnline = false;

const HISTORY_GROUPS = [
  {
    title: "Sala — Temperatura / Umidade",
    series: [
      { topic: topic("sala/dht11/temperature"), label: "Temperatura", color: "#f38ba8", suffix: " °C" },
      { topic: topic("sala/dht11/humidity"), label: "Umidade", color: "#89b4fa", suffix: " %" },
    ],
  },
  {
    title: "Quarto — Temperatura / Umidade",
    series: [
      { topic: topic("quarto/dht11/temperature"), label: "Temperatura", color: "#f38ba8", suffix: " °C" },
      { topic: topic("quarto/dht11/humidity"), label: "Umidade", color: "#89b4fa", suffix: " %" },
    ],
  },
  {
    title: "Cozinha — Fumaça",
    series: [
      { topic: topic("cozinha/fumaca/percentage"), label: "Fumaça", color: "#f9e2af", suffix: " %" },
    ],
  },
  {
    title: "Sala — Luminosidade",
    series: [
      { topic: topic("sala/ldr/luminosity"), label: "Lux", color: "#cba6f7", suffix: " %" },
    ],
  },
];

let historyCharts = {};

function timeLabel(ts) {
  const d = new Date(ts * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function loadHistory() {
  const grid = document.getElementById("history-grid");
  if (!grid) return;

  for (const group of HISTORY_GROUPS) {
    if (!historyCharts[group.title]) {
      const box = document.createElement("div");
      box.className = "history-chart";
      const header = document.createElement("div");
      header.className = "history-head";
      const title = document.createElement("h3");
      title.textContent = group.title;
      const csvLink = document.createElement("a");
      csvLink.className = "csv-link";
      csvLink.href = `/api/export/readings.csv?topic=${encodeURIComponent(group.series[0].topic)}`;
      csvLink.download = "";
      csvLink.textContent = "CSV";
      const canvas = document.createElement("canvas");
      header.appendChild(title);
      header.appendChild(csvLink);
      box.appendChild(header);
      box.appendChild(canvas);
      grid.appendChild(box);
      historyCharts[group.title] = { group, canvas, chart: null };
    }
  }

  for (const entry of Object.values(historyCharts)) {
    try {
      const datasets = [];
      let hasData = false;
      for (const s of entry.group.series) {
        const response = await fetch(`/api/history?topic=${encodeURIComponent(s.topic)}&limit=120`);
        if (response.status === 401) {
          redirectToLogin();
          return;
        }
        if (!response.ok) continue;
        const data = await response.json();
        if (data.ok && data.points.length) hasData = true;
        datasets.push({
          label: s.label + (s.suffix || ""),
          data: (data.points || []).map((p) => ({ x: p.ts, y: p.value })),
          borderColor: s.color,
          backgroundColor: s.color + "33",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
        });
      }

      if (entry.chart) {
        entry.chart.data.datasets = datasets;
        entry.chart.update();
        continue;
      }
      if (!datasets.length) continue;

      entry.chart = new Chart(entry.canvas, {
        type: "line",
        data: { datasets },
        options: {
          responsive: true,
          animation: false,
          parsing: { xAxisKey: "x", yAxisKey: "y" },
          scales: {
            x: {
              type: "linear",
              ticks: {
                color: "#a6adc8",
                maxTicksLimit: 8,
                callback: timeLabel,
              },
              grid: { color: "rgba(108,112,134,0.15)" },
            },
            y: {
              beginAtZero: true,
              ticks: { color: "#a6adc8" },
              grid: { color: "rgba(108,112,134,0.15)" },
            },
          },
          plugins: {
            legend: { labels: { color: "#cdd6f4", usePointStyle: true, pointStyle: "line" } },
            tooltip: {
              callbacks: {
                title: (items) => (items.length ? timeLabel(items[0].parsed.x) : ""),
              },
            },
          },
        },
      });
    } catch (error) {
      console.error("Falha ao carregar histórico", error);
    }
  }
}

function startStream() {
  if (!("EventSource" in window)) {
    refresh();
    setInterval(refresh, POLL_MS);
    return;
  }

  const source = new EventSource("/api/stream");

  source.addEventListener("snapshot", (event) => {
    const data = JSON.parse(event.data);
    liveOnline = Boolean(data.online);
    currentState = data.state || {};
    render({ state: currentState, online: liveOnline });
  });

  source.addEventListener("meta", (event) => {
    const data = JSON.parse(event.data);
    liveOnline = Boolean(data.online);
    setConnection(liveOnline);
  });

  source.onerror = async () => {
    try {
      const response = await fetch("/api/state", { method: "GET" });
      if (response.status === 401) redirectToLogin();
    } catch (error) {
      // rede indisponível; o EventSource tenta reconectar
    }
  };

  source.onmessage = (event) => {
    const data = JSON.parse(event.data);
    currentState[data.topic] = data.value;
    render({ state: currentState, online: liveOnline });
  };
}

buildRooms();
bindControls();
startStream();

/* ---------- Alertas / notificações ---------- */

const ALERT_KEYS = [
  { topic: topic("principal/alarme/triggered"), banner: "ALERTA: Alarme disparado!" },
  { topic: topic("cozinha/fumaca/state"), banner: "ALERTA: Fumaça detectada na cozinha!" },
];
let muted = localStorage.getItem("maquete_mute") === "1";

const activeToasts = {};
const dismissed = {};

function toastEl(topic, message) {
  const toast = document.createElement("div");
  toast.className = "alert-banner";
  const text = document.createElement("span");
  text.textContent = message;
  const close = document.createElement("button");
  close.className = "alert-close";
  close.setAttribute("aria-label", "Fechar alerta");
  close.innerHTML = "&times;";
  close.addEventListener("click", () => {
    removeToast(topic);
    dismissed[topic] = true;
  });
  toast.appendChild(text);
  toast.appendChild(close);
  return toast;
}

function removeToast(topic) {
  const toast = activeToasts[topic];
  if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
  delete activeToasts[topic];
}

function checkAlerts() {
  const stack = document.getElementById("alert-stack");
  if (!stack) return;
  ALERT_KEYS.forEach((entry) => {
    const v = currentState[entry.topic];
    if (v === true && !activeToasts[entry.topic] && !dismissed[entry.topic]) {
      const toast = toastEl(entry.topic, entry.banner);
      stack.appendChild(toast);
      activeToasts[entry.topic] = toast;
      beepAlarm();
      sendNotification(entry.banner);
    } else if (v !== true) {
      removeToast(entry.topic);
      dismissed[entry.topic] = false;
    }
  });
}

/* ---------- Som (Web Audio) e notificações do navegador ---------- */

let audioCtx = null;

function beepAlarm() {
  if (muted || !audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.setValueAtTime(440, now + 0.2);
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.5);
}

function unlockAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      return;
    }
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

function sendNotification(message) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification("Maquete Inteligente", { body: message, tag: "maquete-alert" });
  } catch (error) {
    // ignorar falha de notificação
  }
}

function updateSoundLabel() {
  const el = document.getElementById("sound-toggle");
  if (el) el.textContent = `Som: ${muted ? "OFF" : "ON"}`;
}

function setupSoundToggle() {
  const el = document.getElementById("sound-toggle");
  if (!el) return;
  updateSoundLabel();
  el.addEventListener("click", () => {
    muted = !muted;
    localStorage.setItem("maquete_mute", muted ? "1" : "0");
    updateSoundLabel();
    if (!muted) unlockAudio();
  });
}

document.addEventListener(
  "click",
  () => {
    unlockAudio();
    requestNotificationPermission();
  },
  { passive: true }
);

/* ---------- Modo férias ---------- */

function updateVacationToggle() {
  const el = document.getElementById("vacation-toggle");
  if (!el) return;
  const on = value("principal/ferias/state") === true;
  el.textContent = `Férias: ${on ? "ON" : "OFF"}`;
  el.classList.toggle("ferias-active", on);
}

function setupVacationToggle() {
  const el = document.getElementById("vacation-toggle");
  if (!el) return;
  el.addEventListener("click", () => {
    const on = value("principal/ferias/state") === true;
    sendCommand(topic("principal/ferias/command"), !on);
  });
}

/* ---------- Linha do tempo (eventos) ---------- */

const ROOM_LABELS = {
  sala: "Sala",
  quarto: "Quarto",
  banheiro: "Banheiro",
  cozinha: "Cozinha",
  escritorio: "Escritório",
  garagem: "Garagem",
};

function eventDescriptor(ev) {
  const suffix = ROOT + "/";
  const topic = ev.topic.startsWith(suffix) ? ev.topic.slice(suffix.length) : ev.topic;
  const parts = topic.split("/");
  const kind = ev.kind;
  const on = ev.value === true;
  const roomLabel = ROOM_LABELS[parts[0]] || parts[0];

  if (kind === "command") {
    const cmdName = {
      "sala/led": "Luz da sala",
      "quarto/led": "Luz do quarto",
      "banheiro/led": "Luz do banheiro",
      "cozinha/led": "Luz da cozinha",
      "escritorio/led": "Luz do escritório",
      "garagem/led": "Luz da garagem",
      "cozinha/exaustor": "Exaustor",
      "sala/porta": "Porta",
      "garagem/portao": "Portão",
      "principal/alarme": "Alarme",
      "principal/ferias": "Modo férias",
      "test/smoke": "Teste: fumaça",
      "test/motion": "Teste: movimento",
      "test/alarm": "Teste: disparar alarme",
      "test/hall": "Teste: carro no portão",
    }[parts.slice(0, 2).join("/") + (parts[0] === "test" ? "" : "")];
    const label = cmdName || topic;
    return {
      text: `${label} = ${on ? "ON" : "OFF"}`,
      cls: "command",
    };
  }

  switch (topic) {
    case "principal/alarme/state":
      return { text: `Alarme ${on ? "armado" : "desarmado"}`, cls: on ? "on" : "off" };
    case "principal/alarme/triggered":
      return { text: on ? "Alarme disparado!" : "Alarme normalizado", cls: on ? "alert" : "" };
    case "principal/buzzer/state":
      return { text: `Buzzer ${on ? "ligado" : "desligado"}`, cls: on ? "alert" : "" };
    case "principal/ferias/state":
      return { text: `Modo férias ${on ? "ativado" : "desativado"}`, cls: on ? "on" : "off" };
    case "cozinha/fumaca/state":
      return { text: on ? "Fumaça detectada na cozinha!" : "Fumaça normalizada", cls: on ? "alert" : "" };
    case "cozinha/exaustor/state":
      return { text: `Exaustor ${on ? "ligado" : "desligado"}`, cls: on ? "on" : "" };
    case "sala/porta/state":
      return { text: `Porta ${on ? "aberta" : "fechada"}`, cls: on ? "on" : "" };
    case "garagem/portao/state":
      return { text: `Portão ${on ? "aberto" : "fechado"}`, cls: on ? "on" : "" };
    case "garagem/hall/state":
      return { text: on ? "Hall: ímã do carro detectado" : "Hall: sem ímã", cls: on ? "on" : "" };
    case "status/online":
      return { text: `Sistema ${on ? "online" : "offline"}`, cls: on ? "on" : "" };
  }

  if (parts[1] === "led") {
    return { text: `Luz da ${roomLabel} ${on ? "ligada" : "desligada"}`, cls: on ? "on" : "" };
  }
  if (parts.length >= 3 && parts[1] === "movimento") {
    return {
      text: `${on ? "Movimento detectado" : "Movimento cessou"} — ${roomLabel}`,
      cls: on ? "alert" : "",
    };
  }
  return { text: `${topic} = ${String(ev.value)}`, cls: "" };
}

function filterMatches(ev, filter) {
  if (filter === "all") return true;
  if (filter === "command") return ev.kind === "command";
  if (filter === "alert") {
    if (ev.kind === "command") return false;
    const desc = eventDescriptor(ev);
    return desc.cls === "alert" || ev.topic.endsWith("/alarme/triggered") || ev.topic.includes("/fumaca/state");
  }
  if (filter === "sensor") return ev.kind === "state";
  return true;
}

let eventsFilter = "all";
let lastEvents = [];

function renderEvents(events) {
  lastEvents = events;
  const list = document.getElementById("timeline-list");
  if (!list) return;
  const shown = events.filter((ev) => filterMatches(ev, eventsFilter));
  if (!shown.length) {
    list.innerHTML = '<li class="timeline-row"><span class="timeline-na">Sem eventos ainda.</span></li>';
    return;
  }
  list.innerHTML = "";
  shown.forEach((ev) => {
    const desc = eventDescriptor(ev);
    const li = document.createElement("li");
    li.className = "timeline-row " + desc.cls;
    const time = document.createElement("span");
    time.className = "timeline-time";
    time.textContent = timeLabel(ev.ts);
    const text = document.createElement("span");
    text.className = "timeline-text";
    text.textContent = desc.text;
    li.appendChild(time);
    li.appendChild(text);
    list.appendChild(li);
  });
}

async function loadEvents() {
  try {
    const response = await fetch("/api/events?limit=60");
    if (response.status === 401) {
      redirectToLogin();
      return;
    }
    if (!response.ok) return;
    const data = await response.json();
    if (data.ok) renderEvents(data.events || []);
  } catch (error) {
    // mantém a última lista em caso de erro de rede
  }
}

function setupTimelineChips() {
  document.querySelectorAll("#timeline-chips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      eventsFilter = chip.dataset.filter;
      document.querySelectorAll("#timeline-chips .chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      renderEvents(lastEvents);
    });
  });
}

/* ---------- Simulador · Testes ---------- */

const TEST_ACTIONS = [
  { id: "test-smoke", component: "test/fumaca/command" },
  { id: "test-motion", component: "test/movimento/command" },
  { id: "test-alarm", component: "test/alarme/command" },
  { id: "test-hall", component: "test/hall/command" },
];

function setupTestButtons() {
  TEST_ACTIONS.forEach((action) => {
    const el = document.getElementById(action.id);
    if (!el) return;
    el.addEventListener("click", () => {
      sendCommand(topic(action.component), true);
      el.classList.add("just-sent");
      setTimeout(() => el.classList.remove("just-sent"), 400);
    });
  });
}

/* Painel de testes é um recurso "secreto": fica oculto e só aparece com
   5 cliques no logo (trava) ou com o hash #painel-teste na URL. */
const PANEL_ALIAS = "#painel-teste";
const PANEL_STORAGE_KEY = "maquete_painel_teste_visivel";

function setupTestPanelSecret() {
  const panel = document.getElementById("card-test-panel");
  if (!panel) return;

  function setVisible(visible) {
    panel.hidden = !visible;
    if (visible) sessionStorage.setItem(PANEL_STORAGE_KEY, "1");
    else sessionStorage.removeItem(PANEL_STORAGE_KEY);
  }

  if (location.hash === PANEL_ALIAS) {
    setVisible(true);
    return;
  }

  if (sessionStorage.getItem(PANEL_STORAGE_KEY) === "1") {
    setVisible(true);
  }

  const brand = document.querySelector(".brand");
  if (!brand) return;
  let clicks = 0;
  let last = 0;
  brand.addEventListener("click", () => {
    const now = Date.now();
    if (now - last > 2000) clicks = 0;
    last = now;
    clicks += 1;
    if (clicks >= 5) {
      clicks = 0;
      setVisible(panel.hidden);
    }
  });
}

/* ---------- Agendamentos ---------- */

const SCHEDULE_ACTIONS = [
  { topic: "sala/led", label: "Luz da sala" },
  { topic: "quarto/led", label: "Luz do quarto" },
  { topic: "banheiro/led", label: "Luz do banheiro" },
  { topic: "cozinha/led", label: "Luz da cozinha" },
  { topic: "escritorio/led", label: "Luz do escritorio" },
  { topic: "garagem/led", label: "Luz da garagem" },
  { topic: "cozinha/exaustor", label: "Exaustor" },
  { topic: "sala/porta", label: "Porta da sala" },
  { topic: "garagem/portao", label: "Portão da garagem" },
  { topic: "principal/alarme", label: "Alarme" },
  { topic: "principal/ferias", label: "Modo férias" },
];

function scheduleCommandTopic(actionTopic) {
  return topic(`${actionTopic}/command`);
}

function buildScheduleSelect() {
  const box = document.getElementById("sched-topic");
  if (!box) return;

  const trigger = box.querySelector(".select-trigger");
  const valueEl = box.querySelector(".select-value");
  const list = box.querySelector(".select-list");
  if (!trigger || !valueEl || !list) return;

  function clearSelected() {
    list.querySelectorAll(".select-option").forEach((o) => o.classList.remove("selected"));
  }

  function setSelected(item) {
    box.dataset.value = item.dataset.value;
    valueEl.textContent = item.textContent;
    clearSelected();
    item.classList.add("selected");
  }

  function openList() {
    list.hidden = false;
    box.classList.add("open");
    const card = box.closest(".card");
    if (card) card.classList.add("card-open");
    trigger.setAttribute("aria-expanded", "true");
  }

  function closeList() {
    list.hidden = true;
    box.classList.remove("open");
    const card = box.closest(".card");
    if (card) card.classList.remove("card-open");
    trigger.setAttribute("aria-expanded", "false");
  }

  SCHEDULE_ACTIONS.forEach((action, index) => {
    const item = document.createElement("li");
    item.className = "select-option";
    item.setAttribute("role", "option");
    item.dataset.value = scheduleCommandTopic(action.topic);
    item.textContent = action.label;
    item.addEventListener("click", () => {
      setSelected(item);
      closeList();
      trigger.focus();
    });
    list.appendChild(item);
    if (index === 0) setSelected(item);
  });

  trigger.addEventListener("click", () => {
    if (list.hidden) openList();
    else closeList();
  });

  document.addEventListener("click", (event) => {
    if (!box.contains(event.target)) closeList();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeList();
  });
}

function scheduleRowLabel(actionTopic) {
  const match = SCHEDULE_ACTIONS.find((a) => scheduleCommandTopic(a.topic) === actionTopic);
  return match ? match.label : actionTopic;
}

function renderSchedules(schedules) {
  const list = document.getElementById("schedules-list");
  if (!list) return;
  if (!schedules.length) {
    list.innerHTML = '<li class="schedules-na">Nenhum agendamento ainda.</li>';
    return;
  }

  list.innerHTML = "";
  schedules.forEach((s) => {
    const li = document.createElement("li");
    li.className = "schedule-row" + (s.enabled ? "" : " disabled");

    const info = document.createElement("div");
    info.className = "schedule-info";
    const name = document.createElement("strong");
    name.textContent = s.label;
    const detail = document.createElement("span");
    detail.textContent = `${s.time} · ${scheduleRowLabel(s.topic)} ${s.value ? "ON" : "OFF"}`;
    info.appendChild(name);
    info.appendChild(detail);

    const toggle = document.createElement("label");
    toggle.className = "toggle";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = s.enabled;
    checkbox.setAttribute("aria-label", "Ativar agendamento");
    checkbox.addEventListener("change", () => {
      fetch(`/api/schedules/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checkbox.checked }),
      }).then(loadSchedules);
    });
    const track = document.createElement("span");
    track.className = "track";
    toggle.appendChild(checkbox);
    toggle.appendChild(track);

    const remove = document.createElement("button");
    remove.className = "ghost remove-btn";
    remove.textContent = "Excluir";
    remove.addEventListener("click", () => {
      fetch(`/api/schedules/${s.id}`, { method: "DELETE" }).then(loadSchedules);
    });

    li.appendChild(info);
    li.appendChild(toggle);
    li.appendChild(remove);
    list.appendChild(li);
  });
}

async function loadSchedules() {
  try {
    const response = await fetch("/api/schedules");
    if (response.status === 401) {
      redirectToLogin();
      return;
    }
    if (!response.ok) return;
    const data = await response.json();
    if (data.ok) renderSchedules(data.schedules || []);
  } catch (error) {
    // mantém a última lista
  }
}

function setupScheduleForm() {
  const add = document.getElementById("sched-add");
  if (!add) return;
  add.addEventListener("click", async () => {
    const label = document.getElementById("sched-label").value.trim();
    const timeStr = document.getElementById("sched-time").value;
    const topicName = document.getElementById("sched-topic").dataset.value;
    const value = document.getElementById("sched-value").checked;
    if (!label || !timeStr) return;
    const response = await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, time: timeStr, topic: topicName, value }),
    });
    if (response.ok) {
      document.getElementById("sched-label").value = "";
      document.getElementById("sched-value").checked = true;
      loadSchedules();
    }
  });
}

/* ---------- Resumo diário ---------- */

const SUMMARY_GROUPS = [
  {
    title: "Sala",
    temp: topic("sala/dht11/temperature"),
    humidity: topic("sala/dht11/humidity"),
  },
  {
    title: "Quarto",
    temp: topic("quarto/dht11/temperature"),
    humidity: topic("quarto/dht11/humidity"),
  },
];

function fmtNumber(value, digits) {
  return value === null || value === undefined ? "—" : Number(value).toFixed(digits || 0);
}

function summaryRow(label, value) {
  const row = document.createElement("div");
  row.className = "row";
  const labelEl = document.createElement("span");
  labelEl.textContent = label;
  const valueEl = document.createElement("strong");
  valueEl.textContent = value;
  row.appendChild(labelEl);
  row.appendChild(valueEl);
  return row;
}

function renderSummary(summary) {
  const box = document.getElementById("summary-rows");
  if (!box) return;

  box.innerHTML = "";

  for (const group of SUMMARY_GROUPS) {
    const temp = summary.sensors[group.temp];
    const humidity = summary.sensors[group.humidity];

    const tempText =
      temp && temp.count > 0
        ? `agora ${fmtNumber(temp.avg, 1)} · máx ${fmtNumber(temp.max, 1)} · mín ${fmtNumber(temp.min, 1)} °C`
        : "—";
    const humiText =
      humidity && humidity.count > 0 ? `máx ${fmtNumber(humidity.max, 0)}%` : "—";

    box.appendChild(summaryRow(`Temp · ${group.title}`, tempText));
    box.appendChild(summaryRow(`Umid · ${group.title}`, humiText));
  }

  const smoke = summary.sensors[`${topic("cozinha/fumaca/percentage")}`];
  const smokeText = smoke && smoke.count > 0 ? `máx ${fmtNumber(smoke.max, 0)}%` : "—";

  const alerts = Object.entries(summary.events)
    .filter(([key]) => key.startsWith("alert:"))
    .reduce((acc, [, count]) => acc + count, 0);
  const commands = Object.entries(summary.events)
    .filter(([key]) => key.startsWith("command:"))
    .reduce((acc, [, count]) => acc + count, 0);

  box.appendChild(summaryRow("Fumaça (cozinha)", smokeText));
  box.appendChild(summaryRow("Alertas hoje", String(alerts)));
  box.appendChild(summaryRow("Comandos hoje", String(commands)));
}

async function loadSummary() {
  const box = document.getElementById("summary-rows");
  if (!box) return;
  try {
    const response = await fetch("/api/summary");
    if (response.status === 401) {
      redirectToLogin();
      return;
    }
    if (!response.ok) return;
    const data = await response.json();
    if (data.ok) renderSummary(data.summary);
  } catch (error) {
    // mantém último resumo
  }
}

/* ---------- Clima externo ---------- */

async function loadWeather() {
  const el = document.getElementById("externo-dht");
  if (!el) return;
  try {
    const response = await fetch("/api/weather");
    if (response.status === 401) {
      redirectToLogin();
      return;
    }
    const data = await response.json();
    if (!data.ok || !data.weather) {
      el.textContent = "--";
      return;
    }
    const w = data.weather;
    const parts = [w.temperature !== null ? `${w.temperature.toFixed(1)}°C` : null];
    if (w.humidity !== null) parts.push(`${w.humidity}%`);
    if (w.label) parts.push(w.label);
    el.textContent = parts.filter(Boolean).join(" · ") || "--";
  } catch (error) {
    el.textContent = "--";
  }
}

/* ---------- Maquete 3D (Three.js) ---------- */

const HOUSE_SCALE = 0.014;
const HOUSE_OFFX = 450;
const HOUSE_OFFZ = 490;

const MODEL_WALL_H = 1.5;
const MODEL_GAP = 30 * HOUSE_SCALE;
const MODEL_UP_H = 1.2;
const MODEL_UP_Y = MODEL_WALL_H + MODEL_GAP;
const MODEL_PATIO_H = 0.5;
const MODEL_OFF = 0x45475a;
const MODEL_LIGHT = 0xffd166;
const MODEL_WARN = 0xf9e2af;
const MODEL_ALERT = 0xf38ba8;
const MODEL_ON = 0xa6e3a1;

const MODEL_ROOMS = [
  { id: "banheiro",   label: "Banheiro",   x: 40,  y: 55,  w: 320, h: 190, floor: 0, light: true,  color: 0xf2cdcd },
  { id: "cozinha",    label: "Cozinha",    x: 380, y: 55,  w: 230, h: 190, floor: 0, light: true,  color: 0xf9e2af },
  { id: "sala",       label: "Sala",       x: 630, y: 55,  w: 230, h: 190, floor: 0, light: true,  color: 0xa6e3a1 },
  { id: "garagem",    label: "Garagem",    x: 40,  y: 275, w: 320, h: 190, floor: 0, light: true,  color: 0x89b4fa },
  { id: "patio",      label: "Pátio",      x: 380, y: 275, w: 480, h: 190, floor: 0, patio: true,  light: false, color: 0xa6adc8 },
  { id: "quarto",     label: "Quarto",     x: 40,  y: 55,  w: 320, h: 190, floor: 1, light: true,  color: 0xcba6f7 },
  { id: "escritorio", label: "Escritório", x: 380, y: 55,  w: 480, h: 190, floor: 1, light: true,  color: 0xb4befe },
];

function modelFootprint(room) {
  return {
    cx: (room.x + room.w / 2 - HOUSE_OFFX) * HOUSE_SCALE,
    cz: (room.y + room.h / 2 - HOUSE_OFFZ) * HOUSE_SCALE,
    sw: Math.max(room.w * HOUSE_SCALE, 0.3),
    sd: Math.max(room.h * HOUSE_SCALE, 0.3),
  };
}

function setMeshColor(mesh, hex) {
  if (mesh) mesh.material.color.setHex(hex);
}

let _r3d = null;

function init3D() {
  const el = document.getElementById("model-3d");
  if (!el || _r3d) return;

  if (!window.THREE) {
    el.innerHTML = '<span class="model-na">Modelo 3D indisponível (biblioteca não carregou).</span>';
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (error) {
    el.innerHTML = '<span class="model-na">WebGL não disponível neste dispositivo.</span>';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(el.clientWidth, el.clientHeight);
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.1, 200);
  camera.position.set(11, 12.4, 9.64);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2.4, -3.36);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 4;
  controls.maxDistance = 40;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.2;
  controls.addEventListener("start", () => {
    controls.autoRotate = false;
  });

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(10, 18, 8);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xb4befe, 0.25);
  fill.position.set(-8, 6, -10);
  scene.add(fill);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshLambertMaterial({ color: 0x181825 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  const grid = new THREE.GridHelper(24, 24, 0x3a3a4f, 0x2a2a3d);
  scene.add(grid);

  const roomMeshes = [];
  const roomData = {};

  MODEL_ROOMS.forEach((room) => {
    const fp = modelFootprint(room);
    const levelY = room.floor === 0 ? 0 : MODEL_UP_Y;
    const wallH = room.patio ? MODEL_PATIO_H : room.floor === 0 ? MODEL_WALL_H : MODEL_UP_H;
    const geo = new THREE.BoxGeometry(fp.sw, wallH, fp.sd);
    const mat = new THREE.MeshLambertMaterial({
      color: room.color,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(fp.cx, levelY + wallH / 2, fp.cz);
    mesh.userData.roomId = room.id;
    scene.add(mesh);
    roomMeshes.push(mesh);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x45475a, transparent: true, opacity: 0.9 })
    );
    edges.position.copy(mesh.position);
    scene.add(edges);

    roomData[room.id] = { room, fp, mesh, mat, levelY, light: null, motion: null, smoke: null, door: null, gate: null };
  });

  function addMarker3D(roomId, svgX, svgY, shape, size, yOffset) {
    const rd = roomData[roomId];
    if (!rd) return null;
    const mesh = new THREE.Mesh(
      shape === "box"
        ? new THREE.BoxGeometry(size, size * 0.55, Math.max(0.14, size * 0.15))
        : new THREE.SphereGeometry(size / 2, 20, 14),
      new THREE.MeshBasicMaterial({ color: MODEL_OFF })
    );
    mesh.position.set(
      (svgX - HOUSE_OFFX) * HOUSE_SCALE,
      rd.levelY + yOffset,
      (svgY - HOUSE_OFFZ) * HOUSE_SCALE
    );
    scene.add(mesh);
    return mesh;
  }

  MODEL_ROOMS.forEach((room) => {
    if (!room.light) return;
    const ceil = room.patio ? MODEL_PATIO_H : room.floor === 0 ? MODEL_WALL_H : MODEL_UP_H;
    roomData[room.id].light = addMarker3D(
      room.id,
      room.x + room.w / 2,
      room.y + room.h / 2,
      "sphere",
      0.5,
      ceil - 0.28
    );
  });

  roomData.garagem.gate = addMarker3D("garagem", 200, 447, "box", 1.0, 0.55);

  const sensorStacks = [
    { room: "sala", key: "door", corner: [644, 66], height: 0.42 },
    { room: "sala", key: "motion", corner: [644, 66], height: 0.85 },
    { room: "garagem", key: "motion", corner: [59, 286], height: 0.6 },
    { room: "patio", key: "motion", corner: [409, 286], height: 0.25 },
    { room: "cozinha", key: "smoke", corner: [394, 66], height: 0.8 },
  ];
  sensorStacks.forEach((s) => {
    roomData[s.room][s.key] = addMarker3D(s.room, s.corner[0], s.corner[1], "sphere", 0.55, s.height);
  });

  const slab = new THREE.Mesh(
    new THREE.BoxGeometry((860 - 40) * HOUSE_SCALE, 0.12, 190 * HOUSE_SCALE),
    new THREE.MeshLambertMaterial({ color: 0x313244 })
  );
  slab.position.set(0, (MODEL_WALL_H + MODEL_UP_Y) / 2, (150 - HOUSE_OFFZ) * HOUSE_SCALE);
  scene.add(slab);

  const roofBase = (870 - 30) * HOUSE_SCALE;
  const roofDepth = (265 - 35) * HOUSE_SCALE;
  const roofH = 1.2;
  const R = roofBase / 2;
  const D = roofDepth / 2;
  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([
      -R, 0, -D,  R, 0, -D,  R, 0, D,  -R, 0, D,
      -R, roofH, 0,  R, roofH, 0
    ], 3)
  );
  roofGeo.setIndex([0, 1, 4, 1, 5, 4,  3, 2, 5, 3, 5, 4,  3, 0, 4,  1, 2, 5]);
  roofGeo.computeVertexNormals();
  const roof = new THREE.Mesh(
    roofGeo,
    new THREE.MeshLambertMaterial({ color: 0x6c7086, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide })
  );
  roof.position.set(0, MODEL_UP_Y + MODEL_UP_H + MODEL_GAP, (150 - HOUSE_OFFZ) * HOUSE_SCALE);
  scene.add(roof);

  const roofEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(roofGeo),
    new THREE.LineBasicMaterial({ color: 0x45475a, transparent: true, opacity: 0.9 })
  );
  roofEdges.position.copy(roof.position);
  scene.add(roofEdges);

  const raycaster = new THREE.Raycaster();
  const pointerDir = new THREE.Vector2();
  let dragStart = null;

  function toNDC(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -((clientY - rect.top) / rect.height) * 2 + 1,
    };
  }

  function pick(clientX, clientY) {
    const ndc = toNDC(clientX, clientY);
    pointerDir.set(ndc.x, ndc.y);
    raycaster.setFromCamera(pointerDir, camera);
    const hits = raycaster.intersectObjects(roomMeshes, false);
    return hits.length ? hits[0].object : null;
  }

  renderer.domElement.addEventListener("pointerdown", (event) => {
    dragStart = { x: event.clientX, y: event.clientY };
  });

  renderer.domElement.addEventListener("pointerup", (event) => {
    if (!dragStart) return;
    const dist = Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y);
    dragStart = null;
    if (dist > 6) return;
    const mesh = pick(event.clientX, event.clientY);
    if (!mesh) return;
    const rd = roomData[mesh.userData.roomId];
    if (!rd || !rd.room.light) return;
    const on = value(`${rd.room.id}/led/state`) === true;
    sendCommand(topic(`${rd.room.id}/led/command`), !on);
  });

  const tip = document.createElement("div");
  tip.className = "model-tip";
  tip.hidden = true;
  el.appendChild(tip);

  renderer.domElement.addEventListener("pointermove", (event) => {
    const mesh = pick(event.clientX, event.clientY);
    renderer.domElement.style.cursor = mesh ? "pointer" : "grab";
    if (!mesh) {
      tip.hidden = true;
      return;
    }
    const rd = roomData[mesh.userData.roomId];
    if (!rd) {
      tip.hidden = true;
      return;
    }
    const lightOn = rd.room.light && value(`${rd.room.id}/led/state`) === true;
    tip.textContent = rd.room.label + (rd.room.light ? ` · luz ${lightOn ? "ligada" : "desligada"}` : "");
    const rect = el.getBoundingClientRect();
    tip.style.left = event.clientX - rect.left + 14 + "px";
    tip.style.top = event.clientY - rect.top + 14 + "px";
    tip.hidden = false;
  });

  renderer.domElement.addEventListener("pointerleave", () => {
    tip.hidden = true;
  });

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(onResize).observe(el);
  } else {
    window.addEventListener("resize", onResize);
  }

  _r3d = { roomData };
  update3D();
}

function update3D() {
  if (!_r3d) return;
  for (const id in _r3d.roomData) {
    const rd = _r3d.roomData[id];
    const floorOn = value(`${id}/led/state`) === true;
    if (rd.room.light) setMeshColor(rd.light, floorOn ? MODEL_LIGHT : MODEL_OFF);
    setMeshColor(rd.motion, value(`${id}/movimento/state`) === true ? MODEL_WARN : MODEL_OFF);
    if (id === "cozinha") setMeshColor(rd.smoke, value("cozinha/fumaca/state") === true ? MODEL_ALERT : MODEL_OFF);
    if (id === "sala") setMeshColor(rd.door, value("sala/porta/state") === true ? MODEL_ON : MODEL_OFF);
    if (id === "garagem") setMeshColor(rd.gate, value("garagem/portao/state") === true ? MODEL_ON : MODEL_OFF);
    if (rd.room.light) {
      rd.mat.emissive.setHex(floorOn ? MODEL_LIGHT : 0x000000);
      rd.mat.emissiveIntensity = floorOn ? 0.25 : 0;
    }
  }
}

/* ---------- PWA / service worker ---------- */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Falha ao registrar service worker", error);
    });
  });
}

/* ---------- Inicialização ---------- */

setupSoundToggle();
setupVacationToggle();
setupTimelineChips();
setupTestButtons();
setupTestPanelSecret();
buildScheduleSelect();
setupScheduleForm();
init3D();
loadSchedules();
setInterval(loadSchedules, 20000);
loadEvents();
setInterval(loadEvents, 5000);
loadHistory();
setInterval(loadHistory, 30000);
loadSummary();
setInterval(loadSummary, 60000);
loadWeather();
setInterval(loadWeather, 600000);