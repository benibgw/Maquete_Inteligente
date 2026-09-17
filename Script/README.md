# Script — Ponte Serial ⇄ MQTT (middleware)

Script em **Python** que conecta o **Firmware** (Arduino Mega 2560) ao **Broker MQTT**,
funcionando como middleware entre a Serial e a nuvem.

```
Firmware (Serial 9600, JSON por linha) ⇄ Script ⇄ Broker MQTT (maquete_inteligente/...)
                                                  ⇄ WebSite
```

## O que faz

- **Serial → MQTT**: cada linha JSON recebida da Serial (ex.: `{"maquete_inteligente/sala/led/state":true}`)
  é publicada no broker no respectivo tópico, com `retain=True` (os `state` sobrevivem a
  reinícios e o WebSite recupera os valores).
- **MQTT → Serial**: mensagens recebidas em qualquer tópico `.../command` são enviadas para a
  Serial no mesmo formato JSON, para o firmware executar.
- Detecta automaticamente a porta do Arduino por **VID/PID** (filtro), com retry em caso de falha.

## Como rodar

```bash
cd Script
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Dependências (`requirements.txt`): `paho-mqtt`, `pyserial`.

## Configuração

| Variável de ambiente | Padrão | Descrição |
| --- | --- | --- |
| `ARDUINO_PORT` | autodetect | Força a porta serial (ex.: `/dev/ttyACM0`) |
| `ARDUINO_VID` | — | VID do dispositivo para filtro (ex.: `2341`) |
| `ARDUINO_PID` | — | PID do dispositivo (ex.: `0043`) |

Constantes no topo de `main.py`:

- `SERIAL_BAUDRATE = 9600`
- `MQTT_BROKER = "broker.mqtt.cool"`, `MQTT_PORT = 1883`
- `MQTT_USERNAME` / `MQTT_PASSWORD` (autenticação opcional)

VID/PID conhecidos de fábrica: **Arduino Mega 16U2** `2341:0042/0043/0243` e **CH340** `1A86:7523`.
Use `ARDUINO_VID`/`ARDUINO_PID` para adicionar outros. Se não houver filtro vidando,
cai num fallback por descrição ("Arduino" ou "USB").

## Fluxo de dados

1. Conecta (com retry de 5s) ao broker MQTT e se inscreve em `maquete_inteligente/#`.
2. Conecta à Serial do Arduino (retry de 5s se a porta não for encontrada).
3. Loop principal: lê linhas da Serial e publica no broker; `on_message` roteia comandos
   para a Serial.
4. Em perda de conexão serial, reconecta automaticamente e atualiza o estado interno.

## Observações

- Para **testar a integração site ↔ MQTT sem hardware**, use o `Project_Test/simulator.py`:
  ele substitui o firmware + este script. **Não rode os dois ao mesmo tempo** — publicam nos
  mesmos tópicos `state`.
- O heartbeat do firmware (`maquete_inteligente/status/online`) é republicado **sem** `retain`,
  para o WebSite usar como indicador de online.