# WebSite — Maquete Inteligente (Flask + MQTT)

Interface web de **monitoramento e controle** da maquete. Um servidor **Flask** assina os
tópicos MQTT, mantém o estado em memória e expõe uma página responsiva (dark mode) que
mostra os sensores em tempo real e envia comandos aos atuadores.

Recursos além do controle em tempo real:
- **Login obrigatório** (usuário/senha por variáveis de ambiente) em todas as rotas e APIs.
- **Persistência do último estado** em SQLite: ao reiniciar, o painel recupera os valores
  conhecidos mesmo que o firmware/broker estejam fora.
- **Histórico das leituras** com gráficos no painel (`GET /api/history` + Chart.js).
- **Linha do tempo de eventos** (`GET /api/events`) com filtros *Tudo / Alertas / Sensores / Comandos*.
- **Alertas** (toasts empilhados no canto inferior, som e notificação do navegador) quando o alarme dispara ou há fumaça.
- **PWA** installable (manifest + service worker).

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
- **Ambiente**: temperatura/umidade (DHT11) da sala e do quarto.
- **Cozinha**: nível de fumaça (barra) + alerta, e exaustor (toggle).
- **Iluminação**: um card por cômodo com LDR (barra de luz) e toggle do LED.
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
assinado com `SECRET_KEY`). As APIs respondem **401** quando não autenticadas; o frontend
redireciona para `/login` automaticamente.

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

> Todas as rotas `/api/*` exigem login (demais: 401).

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

- `db.py` cria `WebSite/data.db` (gitignored) com três tabelas:
  - `state` — último valor conhecido por tópico (JSON), restaurado no boot;
  - `readings` — série temporal de valores **numéricos** (temp, umidade, fumaça, LDR, ângulos…),
    com índice por `(topic, ts)`;
  - `events` — **linha do tempo**: transições de valores booleanos (`kind="state"`) e comandos
    enviados (`kind="command"`), com índice por `ts`.
- Tópicos `.../command`, `status/online` e `test/*` não são persistidos; eventos não são gerados
  para valores numéricos nem para tópicos de `test/`.
- Leituras e eventos mais antigos que `HISTORY_RETENTION_DAYS` (padrão 7) são podados
  automaticamente.

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

As constantes ficam no topo de `app.py` e podem ser sobrescritas por variáveis de ambiente
com o mesmo nome (ex.: `MQTT_BROKER`, `WEB_HOST`):

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

## Como funciona internamente

- Um thread `mqtt_worker` mantém `loop_forever()`, reconectando a cada 5s em caso de falha.
- `on_message` normaliza o payload (JSON), grava no dict `state` com lock, persiste no SQLite,
  registra leituras no histórico e faz broadcast para os clientes do SSE.
- O frontend usa `EventSource("/api/stream")` (com fallback para polling de `/api/state`) e
  atualiza a interface sem recarregar. No header há um badge com o horário da última atualização.
- A página fica com opacidade reduzida quando o sistema está offline.
- Autenticação: decorator `login_required` protege `/`, `/api/state`, `/api/history`,
  `/api/events`, `/api/stream` e `/api/command`; `/login` e `/logout` são públicas.

## Observações

- **Não rode o WebSite junto de dois publicadores de `state`** — o `Project_Test` substitui o
  `Script` para testes sem hardware, mas use apenas um deles por vez com o mesmo broker/root.
- `broker.mqtt.cool` é um broker público de testes, sem autenticação.