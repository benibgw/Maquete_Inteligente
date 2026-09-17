# WebSite — Maquete Inteligente (Flask + MQTT)

Interface web de **monitoramento e controle** da maquete. Um servidor **Flask** assina os
tópicos MQTT, mantém o estado em memória e expõe uma página responsiva (dark mode) que
mostra os sensores em tempo real e envia comandos aos atuadores.

```
Navegador (HTTP poll /api/state, POST /api/command)
        │
        ▼
WebSite (Flask + paho-mqtt) ⇄ Broker MQTT (maquete_inteligente/...)
```

## Estrutura

```
WebSite/
├── app.py                    # Flask + cliente MQTT (assina e guarda o estado)
├── requirements.txt          # flask, paho-mqtt
├── templates/
│   └── index.html            # página principal
└── static/
    ├── css/style.css         # tema dark mode
    └── js/app.js             # poll, renderização e comandos
```

## O que o painel mostra

- **Segurança**: alarme (armado/desarmado), disparo, buzzer; armar/desarmar e buzzer ON/OFF.
- **Presença**: movimento na sala, garagem e pátio.
- **Acessos**: porta da sala (estado e ângulo do servo), portão da garagem (estado e posição), sensor Hall.
- **Ambiente**: temperatura/umidade (DHT11) da sala e do quarto.
- **Cozinha**: nível de fumaça (barra) + alerta, e exaustor (toggle).
- **Iluminação**: um card por cômodo com LDR (barra de luz) e toggle do LED.

## Como rodar

```bash
cd WebSite
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Acesse http://localhost:5000. O badge no topo indica o estado da conexão
(`online`/`offline`): o WebSite considera o sistema online se o heartbeat
(`maquete_inteligente/status/online`) chegar a cada menos de 40s (o firmware/simulador
publica a cada 30s).

## API HTTP

### `GET /api/state`

Retorna o estado atual (online/offline + snapshot de todos os tópicos):

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

### `POST /api/command`

Envia um comando para um tópico `command`. O corpo deve ser um JSON:

```json
{ "topic": "maquete_inteligente/sala/led/command", "value": true }
```

Validações: tópico dentro do root `maquete_inteligente/`, deve terminar em `/command`
e `value` deve ser booleano. Resposta: `{"ok": true}` ou erro com código 400.

## Configuração

As constantes ficam no topo de `app.py`:

| Constante | Padrão | Descrição |
| --- | --- | --- |
| `MQTT_BROKER` | `broker.mqtt.cool` | Endereço do broker |
| `MQTT_PORT` | `1883` | Porta do broker |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | `None` | Autenticação opcional |
| `MQTT_ROOT_TOPIC` | `maquete_inteligente` | Root dos tópicos |
| `ONLINE_TIMEOUT` | `40.0` | Tempo (s) sem heartbeat para marcar offline |
| `WEB_HOST` / `WEB_PORT` | `0.0.0.0` / `5000` | Onde o Flask escuta |

## Como funciona internamente

- Um thread `mqtt_worker` mantém `loop_forever()`, reconectando a cada 5s em caso de falha.
- `on_message` normaliza o payload (JSON) e grava no dict `state` com lock.
- O frontend faz `fetch("/api/state")` a cada 1s e atualiza a interface sem recarregar.
- A página fica com opacidade reduzida quando o sistema está offline.

## Observações

- **Não rode o WebSite junto de dois publicadores de `state`** — o `Project_Test` substitui o
  `Script` para testes sem hardware, mas use apenas um deles por vez com o mesmo broker/root.
- `broker.mqtt.cool` é um broker público de testes, sem autenticação.