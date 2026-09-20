# Firmware — Maquete Inteligente (Arduino Mega 2560)

Firmware da maquete, escrito em **C++** para a placa **Arduino Mega 2560** com **PlatformIO**.
Lê os sensores, aciona os atuadores, aplica regras automáticas e se comunica com o restante
do sistema pela **Serial (9600 baud)** usando **JSON por linha** no padrão de tópicos.

```
Serial 9600 (JSON por linha) ⇄ Script → MQTT → WebSite
```

## Estrutura

```
Firmware/
├── platformio.ini          # ambiente, placa e dependências
├── src/
│   ├── main.cpp            # setup/loop chamando a Maquete
│   └── Maquete/
│       ├── Maquete.hpp     # declaração da classe orquestradora
│       └── Maquete.cpp     # leitura, regras, serial, display e publishes
└── Hardware/
    ├── Leds/               # LED alto brilho (liga/desliga)
    ├── Buzzers/            # buzzer ativo (tom de alarme)
    ├── Servos/             # micro servo SG90 (porta)
    ├── MQ2/                # gás/fumaça (analógico + digital)
    ├── DHT11/              # temperatura e umidade
    ├── MHSR602/            # presença (PIR)
    ├── KY003/              # sensor Hall (portão)
    ├── MC38/               # sensor magnético de porta/portão (NO/NC)
    ├── LDR/                # luminosidade
    ├── Cooler/             # mini cooler 5V (exaustor)
    ├── Nema17/             # motor de passo (portão, não-bloqueante)
    └── Display/            # LCD OLED 128x64 (SSD1306, I2C)
```

## Mapa de pinos

| Componente | Pino | Observação |
| --- | --- | --- |
| LEDs sala/quarto/banheiro/cozinha/escritorio/garagem | 22, 23, 24, 25, 26, 27 | |
| LDRs sala/quarto/banheiro/cozinha/escritorio/garagem | A0, A1, A2, A3, A4, A5 | |
| MC38 porta da sala / portão da garagem | 28, 29 | `INPUT_PULLUP` |
| MQ-2 cozinha | A6 (analógico), 30 (digital) | |
| KY-003 hall da garagem | 31 | |
| MHSR602 presença sala/garagem/pátio | 32, 33, 34 | |
| DHT11 sala / quarto | 35, 36 | |
| Cooler exaustor da cozinha | 5 | **Timer3** — não usar o 44 (Timer5) |
| Servo porta da sala | 37 | |
| NEMA-17 portão | 38, 39, 40, 41 | full-step (2 fases), não-bloqueante |
| Buzzer | 42 | |
| Display OLED 128x64 | I2C (SDA/SCL), endereço `0x3C` | |

## Regras automáticas (`Maquete.cpp`)

- **Luzes**: escuro (< 20% de luz) liga; claro (> 50%) e sem presença desliga. Presença mantém
  a luz ligada por 30s. Comando manual do usuário sobrepõe por 60s.
- **Modo férias**: com `principal/ferias/state = true`, as luzes dos cômodos seguem um padrão
  determinístico (agenda pseudo-aleatória sem `random()`, baseada em `millis()`) para simular
  ocupação; comando manual continua sobrepondo por 60s. Ao desativar, voltam as regras normais.
- **Exaustor**: liga enquanto houver fumaça (MQ-2) e desliga quando passa; comando manual
  sobrepõe por 60s.
- **Portão**: o sensor Hall (KY-003) abre o portão ao detectar ímã (carro), que fecha
  automaticamente após 30s.
- **Alarme**: armado, presença em qualquer ambiente dispara (`triggered`) e ativa o buzzer até ser desarmado.

## Protocolo Serial

Cada linha publicada é um JSON com um único par `tópico` → `valor`:

```json
{"maquete_inteligente/sala/led/state":true}
{"maquete_inteligente/cozinha/fumaca/percentage":42.3}
```

Comandos recebidos seguem o mesmo formato no tópico `/command`, ex.:

```json
{"maquete_inteligente/sala/led/command":true}
{"maquete_inteligente/principal/ferias/command":true}
```

O valor booleano é interpretado de forma tolerante: aceita `true`/`false` (JSON) ou as strings
`"true"`/`"false"`; qualquer outro valor é tratado como `false`.

O boot publica o estado completo; depois os updates são por mudança
(`PublishIfChanged`, com tolerância 0.1 para valores float). Heartbeat em
`maquete_inteligente/status/online` a cada 30s. Os tópicos de `state` são publicados com
`retain=True` pelo Script (o firmware só escreve na Serial).

## Como compilar e gravar

Pré-requisito: PlatformIO Core (`pip install platformio` ou extensão do VSCode).

```bash
cd Firmware
pio run                 # compilar
pio run -t upload       # compilar e gravar no Mega
pio device monitor -b 9600   # acompanhar a Serial
```

Dependências (`platformio.ini`):
- `adafruit/DHT sensor library` (v1.4.x)
- `arduino-libraries/Servo`
- `adafruit/Adafruit SSD1306` (v2.5.x)
- `adafruit/Adafruit GFX Library` (v1.11.x)
- `bblanchon/ArduinoJson` (v7)

## Observações

- **Timer5**: a lib `Servo` usa o Timer5 do Mega. O cooler foi movido para o **pino 5 (Timer3)**;
  se for trocar o fio, ligue o exaustor no pino 5.
- **DHT11**: cada sensor (sala e quarto) é lido alternadamente, um por ciclo de 2s — mantém o
  intervalo mínimo de 1s exigido pelo sensor e reduz o bloqueio do loop pela metade.
- **Watchdog (WDT)**: habilitado com timeout de 8s. Se o loop travar, a placa reinicia sozinha.
- **MC38 (NO/NC)**: o construtor aceita `activeHigh`. Com `INPUT_PULLUP` + contato NC,
  use `MC38Class(pin, false)` para `HIGH` = porta aberta (padrão é `true`).
- O servo inicia em 0° no boot.
- **Debounce de contatos**: os sensores MC38 (porta/portão) e KY-003 (Hall) são amostrados a cada
  iteração do loop (`UpdateFastSensors`) e estabilizados com debounce de 40ms — evita toggles
  falsos por bounce físico e deixa a detecção mais rápida (ms em vez de 2s).
- **MQ-2**: o percentual analógico é suavizado com EMA (alpha 0.3) para reduzir ruído e falsos
  alertas; o estado binário `fumaca/state` continua vindo do pino digital (histerese do LM393).
- A página do display (SSD1306) alterna a cada 5s entre: Segurança, Cozinha, Ambiente e Acessos.
  A página **Segurança** também indica o estado do **modo férias** (linha inferior).