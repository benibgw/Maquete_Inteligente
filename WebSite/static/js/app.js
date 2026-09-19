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
      const title = document.createElement("h3");
      title.textContent = group.title;
      const canvas = document.createElement("canvas");
      box.appendChild(title);
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
loadEvents();
setInterval(loadEvents, 5000);
loadHistory();
setInterval(loadHistory, 30000);