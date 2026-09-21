# WebSite — Maquete Inteligente (Flask + MQTT)

Interface web de **monitoramento e controle** da maquete. Um servidor **Flask** assina os
tópicos MQTT, mantém o estado em memória e expõe uma página responsiva (dark mode) que
mostra os sensores em tempo real e envia comandos aos atuadores.

Recursos além do controle em tempo real:
- **Login obrigatório** (usuário/senha por variáveis de ambiente) em todas as rotas e APIs
  (exceção: `GET /api/health`, liveness probe público).
- **Persistência do último estado** em SQLite: ao reiniciar, o painel recupera os valores
  conhecidos mesmo que o firmware/broker estejam fora.
- **Histórico das leituras** com gráficos no painel (`GET /api/history` + Chart.js).
- **Linha do tempo de eventos** (`GET /api/events`) com filtros *Tudo / Alertas / Sensores / Comandos*.
- **Alertas** (toasts empilhados no canto inferior, som e notificação do navegador) quando o alarme dispara ou há fumaça.
- **PWA** installable (manifest + service worker).
- **Cenas rápidas**: executa um conjunto de comandos em sequência no broker (ex.: *Sair de casa*,
  *Chegar em casa*).
- **Agendamentos**: dispara um comando em horário fixo (HH:MM) todos os dias, com o dia do último
  disparo guardado no banco para não repetir no mesmo dia.
- **Maquete 3D** (Three.js, via CDN): casa 3D interativa com dois andares e telhado; arrastar
  gira/zoom; clicar num cômodo liga/desliga a luz e os indicadores refletem sensores (luz,
  movimento, fumaça, porta, portão).
- **Resumo de hoje**: agregados do dia (mín/máx/atual de temperatura/umidade, fumaça máx, nº de
  alertas e comandos).
- **Clima externo**: temperatura/umidade/vento e condição do tempo via Open-Meteo (sem
  dependência externa), com cache de 10 minutos.
- **Exportar CSV**: download de eventos e de leituras por tópico em formato compatível com
  Excel pt-BR (`;` como separador + BOM UTF-8).

```
Navegador (SSE /api/stream, GET /api/state, POST /api/command, GET /api/history, GET /api/events)
        │
        ▼
WebSite (Flask + paho-mqtt + SQLite) ⇄ Broker MQTT (maquete_inteligente/...)
```

## Estrutura

```
WebSite/
├── app.py                    # Flask + cliente MQTT (assina, guarda o estado, autentica)
├── db.py                     # persistência do estado + histórico (SQLite)
├── data.db                   # banco gerado em runtime (gitignored)
├── requirements.txt          # flask, paho-mqtt
├── templates/
│   ├── index.html            # página principal
│   └── login.html            # página de login
└── static/
    ├── css/style.css         # tema dark mode
    ├── js/app.js             # poll, renderização, comandos, alertas, históricos
    ├── manifest.json         # PWA
    ├── sw.js                 # service worker (cache do app shell)
    └── icon.svg              # ícone da PWA
```

## O que o painel mostra

- **Segurança**: alarme (armado/desarmado), disparo (badge de destaque), buzzer; armar/desarmar;
  com o alarme disparado o painel fica destacado e soa um alerta.
- **Presença**: movimento na sala, garagem e pátio.
- **Acessos**: porta da sala (estado e ângulo do servo), portão da garagem (estado e posição), sensor Hall.
- **Ambiente**: temperatura/umidade (DHT11) da sala, do quarto e **tempo externo** (Open-Meteo).
- **Cozinha**: nível de fumaça (barra) + alerta, e exaustor (toggle).
- **Iluminação**: um card por cômodo com LDR (barra de luz) e toggle do LED.
- **Maquete 3D**: casa 3D (Three.js) com os cômodos do térreo e do superior, separados por um
  vão entre os andares; arrastar gira e a rodinha aplica zoom; clique num cômodo alterna a luz.
  As lâmpadas (esferas no teto) e o portão (bloco) ficam nos cômodos; os sensores (movimento,
  fumaça e porta) ficam empilhados num canto de cada cômodo, um sobre o outro, com as cores
  refletindo o estado. Um telhado de duas águas (prisma triangular com base retangular e beiral)
  encerra o modelo; a garagem tem um telhado de duas águas no mesmo estilo, porém mais baixo.
  A câmera gira automaticamente ao redor da casa; ao interagir, a rotação
  automática pausa e, após **30s** sem interação, volta sozinha à vista inicial. O botão
  **Resetar vista** (canto superior direito) faz o mesmo na hora. Fica logo abaixo do card Iluminação.
- **Cenas**: botões *Sair de casa* (apaga todas as luzes, desliga exaustor, fecha porta/portão e
  arma o alarme) e *Chegar em casa* (desarma, abre o portão e acende a sala). Os comandos são
  publicados em sequência com 150ms de intervalo.
- **Agendamentos**: form para agendar um comando num horário (HH:MM) recorrente; lista com
  liga/desliga e excluir. Persistidos no SQLite.
- **Resumo de hoje**: chips com mínimo/máximo/média das leituras do dia e contadores de alertas
  e comandos.
- **Modo férias** (no header): simula ocupação da casa ligando/apagando luzes em padrão
  determinístico (tópicos `principal/ferias`).
- **Painel de testes (simulador)**: botões que forçam eventos via tópicos `test/*/command` —
  fumaça (10s), movimento, disparo de alarme e carro no portão (funciona só quando o
  `Project_Test` é a fonte, não afeta a física da maquete). Fica **oculto por padrão**:
  aparece com `http://.../#painel-teste` na URL ou com **5 cliques na logo** (5 cliques de novo
  escondem).
- **Linha do tempo de eventos**: lista dos últimos eventos (mudanças de estados booleanos e
  comandos enviados), com filtros *Tudo / Alertas / Sensores / Comandos*.
- **Histórico**: gráficos das leituras de sala/quarto (temperatura, umidade), fumaça da
  cozinha e luminosidade da sala.

## Autenticação

Todo o painel (páginas e APIs) exige login. A sessão é mantida por cookie (Flask `session`,
assinado com `SECRET_KEY`). As APIs respondem **401** quando não autenticadas (única exceção:
`GET /api/health`, público); o frontend redireciona para `/login` automaticamente.

Credenciais (obrigatórias por boas práticas — use env, não deixe as padrão em produção):

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `WEB_USER` | `admin` | Usuário do painel |
| `WEB_PASSWORD` | `maquete` | Senha (armazenada com hash via `werkzeug`) |
| `SECRET_KEY` | `maquete-secret-key` | Chave que assina o cookie de sessão |

## Como rodar

```bash
cd WebSite
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Acesse http://localhost:5000 e faça login. O badge no topo indica o estado da conexão
(`online`/`offline`): o WebSite mostra **online** quando o valor de
`maquete_inteligente/status/online` for `true` (heartbeat retido publicado pelo
firmware/simulador, no connect e a cada 30s) **e** esse heartbeat tiver chegado nos últimos
`ONLINE_TIMEOUT` segundos (rede de segurança). Quando a fonte cai, o **LWT** (`false` retido)
marca offline imediatamente.

## API HTTP

> Todas as rotas `/api/*` exigem login (demais: 401), **exceto `GET /api/health`** (público,
> usado como liveness probe).

### `GET /api/health`

**Endpoint público** (não exige login) — liveness probe para monitoramento:

```json
{ "ok": true, "status": "up", "uptime": 1234.5, "mqtt": true, "online": true, "db": true }
```

| Campo | Descrição |
| --- | --- |
| `uptime` | Segundos desde a inicialização do processo |
| `mqtt` | Conexão ativa com o broker MQTT |
| `online` | Heartbeat do firmware/simulador recente (`get_online`) |
| `db` | SQLite respondendo (`SELECT 1`) |

### `GET /api/state`

Retorna o estado atual (online/offline + snapshot de todos os tópicos). Os valores
persistidos em SQLite são carregados no boot, então mesmo com o broker fora o painel
recupera o último estado conhecido.

```json
{
  "online": true,
  "state": {
    "maquete_inteligente/sala/led/state": true,
    "maquete_inteligente/sala/ldr/luminosity": 42.5,
    "...": "..."
  }
}
```

### `GET /api/history`

Série temporal de um tópico numérico (temperatura, umidade, fumaça, luminosidade etc.):

```json
// GET /api/history?topic=maquete_inteligente/sala/dht11/temperature&limit=120
{
  "ok": true,
  "topic": "maquete_inteligente/sala/dht11/temperature",
  "points": [ { "ts": 1690000000.0, "value": 25.5 }, "..."]
}
```

| Parâmetro | Padrão | Descrição |
| --- | --- | --- |
| `topic` | — | Tópico completo (deve estar no root `maquete_inteligente/`) |
| `limit` | `120` | Quantidade de pontos (máx. 2000) |
| `since` | `0` | Timestamp (epoch s) mínimo de corte |

### `GET /api/events`

Linha do tempo: últimos eventos registrados (transições de estados booleanos e comandos
enviados), do mais novo para o mais antigo.

```json
// GET /api/events?limit=60
{
  "ok": true,
  "events": [
    { "ts": 1690000000.0, "kind": "state",  "topic": "maquete_inteligente/principal/alarme/triggered", "value": true },
    { "ts": 1690000000.0, "kind": "command", "topic": "maquete_inteligente/principal/alarme/command", "value": true }
  ]
}
```

| Parâmetro | Padrão | Descrição |
| --- | --- | --- |
| `limit` | `50` | Quantidade de eventos (máx. 500) |
| `since` | `0` | Timestamp (epoch s) mínimo |

### `POST /api/command`

Envia um comando para um tópico `command` (publicado com **QoS 1**). O corpo deve ser um JSON:

```json
{ "topic": "maquete_inteligente/sala/led/command", "value": true }
```

Validações: tópico dentro do root `maquete_inteligente/`, deve terminar em `/command`
e `value` deve ser booleano. Resposta: `{"ok": true}` ou erro com código 400.

### `POST /api/scene`

Executa uma cena pré-definida publicando os comandos em sequência (150ms entre eles, em thread
daemon) e registrando cada um na linha do tempo:

```json
{ "scene": "sair" }
```

Cenas disponíveis: `sair` e `chegar`. Resposta: `{"ok": true, "scene": "sair"}` ou 400 se a
cena não existir. A enfileiramento acontece em segundo plano, então a resposta é imediata.

### `GET /api/schedules` · `POST /api/schedules`

Lista os agendamentos:

```json
{ "ok": true, "schedules": [
  { "id": 1, "label": "Apagar luzes", "time": "23:00",
    "topic": "maquete_inteligente/sala/led/command", "value": false,
    "enabled": true, "last_run_date": null }
] }
```

`POST` cria um agendamento:

```json
{ "label": "Apagar luzes", "time": "23:00",
  "topic": "maquete_inteligente/sala/led/command", "value": false }
```

Validações: `label` obrigatório, `time` em `HH:MM`, `topic` em `.../command` dentro do root e
`value` booleano. Resposta: `{"ok": true, "id": N}`.

### `PATCH /api/schedules/<id>` · `DELETE /api/schedules/<id>`

Atualiza campos parciais do agendamento (`label`, `time`, `topic`, `value`, `enabled`) ou o
exclui. O scheduler verifica a cada `SCHEDULER_POLL` (padrão 20s) se a hora já passou e o
agendamento ainda não rodou hoje (guardado em `last_run_date`); se sim, publica o comando com
QoS 1, registra o evento e marca o dia.

### `GET /api/summary`

Resumo agregado do dia (desde meia-noite, horário local):

```json
{ "ok": true, "summary": {
  "day_start": 1690000000.0,
  "sensors": {
    "maquete_inteligente/sala/dht11/temperature": { "count": 42, "min": 20.0, "max": 26.0, "avg": 23.1 }
  },
  "events": { "alert:maquete_inteligente/principal/alarme/triggered": 1 }
} }
```

### `GET /api/export/events.csv` · `GET /api/export/readings.csv?topic=...`

Baixam **CSV** com separador `;` e **BOM UTF-8** (abre direto no Excel pt-BR). O CSV de eventos
tem as colunas `ts;kind;topic;value`; o de leituras, `ts;value`, limitado ao tópico informado
(obrigatório, deve estar no root). `Content-Disposition` define o nome do arquivo.

### `GET /api/weather`

Clima externo atual, consultado na **Open-Meteo** (sem chave) usando `WEATHER_LAT`/`WEATHER_LON`:

```json
{ "ok": true, "weather": {
  "temperature": 21.3, "humidity": 55, "wind": 9.2, "code": 2, "label": "Parcial. nublado"
} }
```

O resultado é armazenado em cache por `WEATHER_CACHE_TTL` (padrão 600s). Em falha de rede
retorna `{"ok": false}` (e o painel mostra `--` sem quebrar).

### `GET /api/stream`

Event-stream (SSE) usado pela interface para receber atualizações **em tempo real** sem
polling. Ao conectar, envia um evento `snapshot` com `{online, state}`; depois, um evento
por tópico alterado (`data: {topic, value}`) e um evento `meta` com o `online` atualizado a
cada 5s (mantém a conexão viva e atualiza o badge offline/online). O tópico
`maquete_inteligente/status/online` é excluído do snapshot de estado.

### `GET /login` · `POST /login` · `POST /logout`

Página e ação de login/logout. `POST /login` recebe `username`/`password` (form-urlencoded)
e seta a sessão; `POST /logout` limpa a sessão.

## Persistência e histórico (SQLite)

- `db.py` cria `WebSite/data.db` (gitignored) com quatro tabelas:
  - `state` — último valor conhecido por tópico (JSON), restaurado no boot;
  - `readings` — série temporal de valores **numéricos** (temp, umidade, fumaça, LDR, ângulos…),
    com índice por `(topic, ts)`;
  - `events` — **linha do tempo**: transições de valores booleanos (`kind="state"`) e comandos
    enviados (`kind="command"`), com índice por `ts`;
  - `schedules` — **agendamentos** (`label`, `time`, `topic`, `value`, `enabled`,
    `last_run_date`); fica **fora da poda** (não tem `ts`).
- Tópicos `.../command`, `status/online` e `test/*` não são persistidos; eventos não são gerados
  para valores numéricos nem para tópicos de `test/`.
- Leituras e eventos mais antigos que `HISTORY_RETENTION_DAYS` (padrão 7) são podados
  automaticamente: no boot (poda imediata) e, depois, a cada `PRUNE_INTERVAL` (padrão 1h) por
  uma thread daemon dedicada — o banco não cresce sem limite em execuções longas.

## Alertas e som

- Ao detectar a transição `false → true` em `principal/alarme/triggered` ou
  `cozinha/fumaca/state`, o painel mostra um **toast empilhado no canto inferior direito**
  (vários alertas ativos aparecem **simultaneamente**, empilhados com 12px de separação),
  toca um **beep** (Web Audio; depende de interação prévia do usuário, conforme política do
  navegador) e, se a permissão estiver concedida, envia uma **Notificação** do navegador.
- Botão **Som: ON/OFF** no header controla o beep (preferência salva em `localStorage`);
  o toast tem seu próprio **X** de fechar (fechar remove só aquele alerta; ele só reaparece se
  o alerta desativar e voltar a ativar). Os toasts somem automaticamente quando a condição cessa.

## PWA

- `manifest.json` + `sw.js`: o app shell é cacheado e a página pode ser instalada no celular.
- **Atenção**: para instalação/uso completo o serviço deve ser servido em HTTPS (ou
  `localhost`); em HTTP puro na LAN o service worker não registra.

## Configuração

As constantes ficam no topo de `app.py` e `db.py` e podem ser sobrescritas por variáveis de
ambiente com o mesmo nome (ex.: `MQTT_BROKER`, `WEB_HOST`):

| Constante | Padrão | Descrição |
| --- | --- | --- |
| `MQTT_BROKER` | `broker.mqtt.cool` | Endereço do broker |
| `MQTT_PORT` | `1883` | Porta do broker |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | `None` | Autenticação opcional do broker |
| `MQTT_ROOT_TOPIC` | `maquete_inteligente` (fixo) | Root dos tópicos — deve casar com Script/firmware/simulador |
| `ONLINE_TIMEOUT` | `40.0` | Rede de segurança: tempo (s) sem heartbeat `true` para marcar offline |
| `WEB_HOST` / `WEB_PORT` | `0.0.0.0` / `5000` | Onde o Flask escuta |
| `WEB_USER` / `WEB_PASSWORD` / `SECRET_KEY` | `admin` / `maquete` / `maquete-secret-key` | Credenciais do painel |
| `DB_PATH` | `WebSite/data.db` | Caminho do banco SQLite |
| `HISTORY_RETENTION_DAYS` | `7` | Dias de retenção do histórico de leituras |
| `PRUNE_INTERVAL` | `3600` | Intervalo (s) da poda periódica do histórico pela thread daemon |
| `SCHEDULER_POLL` | `20` | Intervalo (s) entre verificações de agendamentos |
| `WEATHER_LAT` / `WEATHER_LON` | `-29.6839` / `-53.8069` | Coordenadas do clima externo (padrão Santa Maria/RS) |
| `WEATHER_CACHE_TTL` | `600` | Cache (s) da resposta do Open-Meteo |

## Como funciona internamente

- Um thread `mqtt_worker` mantém `loop_forever()`, reconectando a cada 5s em caso de falha.
- Uma thread daemon `prune` poda `readings`/`events` a cada `PRUNE_INTERVAL` (a poda imediata
  no boot continua sendo feita na inicialização).
- Uma thread `scheduler` verifica os agendamentos a cada `SCHEDULER_POLL` e publica os comandos
  cuja hora já passou e que ainda não rodaram hoje.
- `on_message` normaliza o payload (JSON), grava no dict `state` com lock, persiste no SQLite,
  registra leituras no histórico e faz broadcast para os clientes do SSE.
- O frontend usa `EventSource("/api/stream")` (com fallback para polling de `/api/state`) e
  atualiza a interface sem recarregar. No header há um badge com o horário da última atualização.
- A página fica com opacidade reduzida quando o sistema está offline.
- Autenticação: decorator `login_required` protege `/`, `/api/state`, `/api/history`,
  `/api/events`, `/api/stream`, `/api/command`, `/api/scene`, `/api/schedules*`,
  `/api/summary`, `/api/export/*` e `/api/weather`; `/login`, `/logout` e `/api/health`
  são públicas.

## Observações

- **Não rode o WebSite junto de dois publicadores de `state`** — o `Project_Test` substitui o
  `Script` para testes sem hardware, mas use apenas um deles por vez com o mesmo broker/root.
- `broker.mqtt.cool` é um broker público de testes, sem autenticação.