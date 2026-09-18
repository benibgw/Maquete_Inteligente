# Projeto IoT — Maquete de Casa Inteligente — Osguri Cap

<p align="center">
  <img src="https://preview.redd.it/why-oguri-cap-is-famous-v0-ai58vhjykoif1.png?width=640&crop=smart&auto=webp&s=7726a01f7fee8debfeda6c3fb79920ed6e064988" alt="Oguri Cap" />
</p>

---

Maquete de uma casa inteligente controlada por um site acessível pelo celular ou notebook.
Sensores e atuadores são gerenciados por um **Arduino Mega 2560**; a comunicação entre as
partes acontece por **MQTT**, com uma ponte **Serial**.

## Tecnologias

| Camada | Stack |
| --- | --- |
| **Firmware** | C++ · PlatformIO · Arduino Mega 2560 |
| **Script** | Python 3 · paho-mqtt · pyserial |
| **WebSite** | Python 3 · Flask · paho-mqtt · HTML/CSS/JavaScript |
| **Testes** | Python 3 · paho-mqtt (`Project_Test`) |
| **Comunicação** | MQTT (broker) + Serial 9600 (JSON por linha) |

Requisitos: **PlatformIO Core** (firmware) e **Python 3** (Script, WebSite e Project_Test).

## Estrutura lógica

O sistema opera em três frentes complementares: **controle manual** pelo usuário, **automações**
baseadas nos sensores e um **painel local** na própria maquete.

### Controle manual (via WebSite)

Pelo site, acessível do celular ou notebook, o usuário pode:
- Ligar/desligar as luzes de cada cômodo (sala, quarto, banheiro, cozinha, escritório e garagem)
- Abrir/fechar a porta da sala (servo) e o portão da garagem (motor de passo)
- Ligar/desligar o exaustor da cozinha
- Armar/desarmar o alarme

### Automações

Funções executadas continuamente pelo firmware a partir da leitura dos sensores:
- **Iluminação**: as luzes acendem quando o ambiente está escuro ou há presença, e apagam quando
  clareia e não há movimento. Um comando manual tem prioridade por 60s.
- **Fumaça/gás (cozinha)**: ao detectar fumaça, liga o exaustor e dispara o alerta; o exaustor
  volta a desligar sozinho quando a leitura normaliza.
- **Portão (garagem)**: o sensor Hall detecta o veículo e abre o portão, que fecha automaticamente
  após 30s.
- **Segurança**: com o alarme armado, a detecção de presença dispara o alarme e o buzzer até ser
  desarmado.
- **Clima**: leitura contínua de temperatura e umidade (DHT11) da sala e do quarto.

### Painel local

Um display OLED 128x64 embutido na maquete mostra o estado do sistema, alternando a cada 5s entre
as páginas **Segurança**, **Cozinha**, **Ambiente** e **Acessos**.

Todo o gerenciamento é feito por meio de um site acessível pelo celular ou notebook, construído
com base em um **Arduino Mega 2560**, com programação em **HTML, CSS, JavaScript, Python e C++**.

## Estrutura física

A maquete é construída em **MDF 20mm**, seguindo o modelo de uma casa moderna de dois andares,
com um dos lados expostos, contando com:
- 2 quartos
- Sala de estar
- Cozinha
- Banheiro
- Garagem
- Pátio frontal

Materiais complementares usados na construção de móveis e estruturas:
- Impressão 3D
- Acrílico
- Vidro
- Alumínio

## Arquitetura / Comunicação

O sistema é dividido em três módulos que se comunicam por um **Broker MQTT**, além de um
simulador para testes sem hardware.

```
Navegador (celular/notebook)
        │ HTTP  GET /api/state · POST /api/command
        ▼
WebSite (Flask + paho-mqtt) ─────┐
        ▲  tópicos /state        │ MQTT
        │                        ▼
Broker MQTT (broker.mqtt.cool) ◄─┤   maquete_inteligente/<cômodo>/<componente>/...
        ▲  tópicos /state        │
        │                        ▼
Script (pyserial + paho-mqtt) ───┘
        ▲ Serial 9600 (JSON por linha)
        ▼
Firmware (Arduino Mega 2560, C++)
```

- **Firmware**: lê os sensores e aciona os atuadores, publicando o estado pela Serial em JSON
  (um tópico por linha) e recebendo comandos pelo mesmo canal.
- **Script** (`Script/main.py`): ponte entre a Serial e o Broker MQTT — repassa comandos ao
  firmware e publica o estado no broker (com `retain`).
- **WebSite** (`WebSite/app.py`): assina os tópicos do broker, mantém o estado atualizado e
  expõe a interface web de monitoramento e controle.
- **Broker MQTT**: usado somente para testes (`broker.mqtt.cool`), será substituído por um
  broker real futuramente.

### Fluxo de um comando (ponta a ponta)

1. O usuário toca em "Abrir portão" no site.
2. O WebSite faz `POST /api/command` e publica em `maquete_inteligente/garagem/portao/command`.
3. O broker entrega ao Script, que escreve `{"maquete_inteligente/garagem/portao/command":true}` na Serial.
4. O firmware move o motor de passo e publica `{"maquete_inteligente/garagem/portao/position":50}` na Serial.
5. O Script republica no broker (com `retain`) e o WebSite atualiza a interface.

### Heartbeat / status online

O firmware publica `maquete_inteligente/status/online` a cada **30s**; o WebSite marca o sistema
como **online** se o heartbeat chegar em menos de **40s**. O `Project_Test` reproduz o mesmo
comportamento para testes sem a placa.

## Estrutura do repositório

```
Maquete_Inteligente/
├── Firmware/       # Arduino Mega 2560 (PlatformIO, C++)
├── Script/         # ponte Serial ⇄ MQTT (Python)
├── WebSite/        # servidor Flask + interface web
├── Project_Test/   # simulador de Arduino via MQTT (testes sem hardware)
└── README.md
```

| Módulo | Pasta | Descrição | Documentação |
| --- | --- | --- | --- |
| **Firmware** | `Firmware/` | Código do Arduino Mega 2560 (PlatformIO, C++) | [README](Firmware/README.md) |
| **Script** | `Script/` | Middleware Serial ⇄ MQTT (Python) | [README](Script/README.md) |
| **WebSite** | `WebSite/` | Servidor Flask + interface web | [README](WebSite/README.md) |
| **Project_Test** | `Project_Test/` | Simulador de Arduino via MQTT (testes sem hardware) | [README](Project_Test/README.md) |

## Uso rápido

**Firmware (Arduino Mega 2560):**
```bash
cd Firmware
pio run -t upload          # compilar e gravar
pio device monitor -b 9600 # acompanhar a Serial
```

**Script (ponte Serial ⇄ MQTT):**
```bash
cd Script
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

**WebSite (interface web):**
```bash
cd WebSite
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python app.py
# abra http://localhost:5000
```

**Project_Test (simular sem a placa):**
```bash
cd Project_Test
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python simulator.py
```

> O `Project_Test` substitui o Firmware + Script: **não rode os dois ao mesmo tempo** (publicam
> nos mesmos tópicos).

## Convenção de tópicos

Todos os tópicos usam o root `maquete_inteligente`:

- `maquete_inteligente/<cômodo>/<componente>/state` — telemetria (estado de sensores/atuadores)
- `maquete_inteligente/<cômodo>/<componente>/command` — controle (comandos do usuário)

### Catálogo de tópicos

| Cômodo | Tópicos `state` (tipos) |
| --- | --- |
| `sala` | `led/state` (bool) · `ldr/luminosity` (0–100) · `porta/state` (bool) · `porta/servo_angle` (0–180) · `movimento/state` (bool) · `dht11/temperature` (°C) · `dht11/humidity` (%) |
| `quarto` | `led/state` (bool) · `ldr/luminosity` (0–100) · `dht11/temperature` (°C) · `dht11/humidity` (%) |
| `banheiro` | `led/state` (bool) · `ldr/luminosity` (0–100) |
| `cozinha` | `led/state` (bool) · `ldr/luminosity` (0–100) · `fumaca/state` (bool) · `fumaca/percentage` (0–100) · `exaustor/state` (bool) |
| `escritorio` | `led/state` (bool) · `ldr/luminosity` (0–100) |
| `garagem` | `led/state` (bool) · `ldr/luminosity` (0–100) · `portao/state` (bool) · `portao/position` (0–50) · `hall/state` (bool) · `movimento/state` (bool) |
| `patio` | `movimento/state` (bool) |
| `principal` | `alarme/state` (bool) · `alarme/triggered` (bool) · `buzzer/state` (bool) |
| `status` | `online` (bool) — heartbeat |

Tópicos `command` (todos booleanos): `{sala,quarto,banheiro,cozinha,escritorio,garagem}/led`,
`cozinha/exaustor`, `sala/porta`, `garagem/portao` e `principal/alarme`.

**Exemplo:** `maquete_inteligente/sala/led/state` (estado da luz) e
`maquete_inteligente/sala/led/command` (ligar/desligar).

## Hardware

### Sensores

| Sensor | Qtd | Cômodo(s) | Função | Tópicos |
| --- | --- | --- | --- | --- |
| MH-SR602 (presença/PIR) | 3 | sala, garagem, pátio | detecta movimento; acende luz / dispara alarme | `<cômodo>/movimento/state` |
| DHT11 (temperatura/umidade) | 2 | sala, quarto | leitura de clima | `<cômodo>/dht11/temperature`, `<cômodo>/dht11/humidity` |
| LDR | 6 | todos os cômodos | luminosidade; base da regra de luz | `<cômodo>/ldr/luminosity` |
| MQ-2 (gás/fumaça) | 1 | cozinha | fumaça → liga exaustor e dispara alerta | `cozinha/fumaca/state`, `cozinha/fumaca/percentage` |
| KY-003 (Hall) | 1 | garagem | detecta o ímã do carro → abre o portão | `garagem/hall/state` |
| MC-38 (magnético) | 2 | porta da sala, portão | detecta abertura | `sala/porta/state`, `garagem/portao/state` |

> Pinagem detalhada em [Firmware/README.md](Firmware/README.md).

### Atuadores

| Atuador | Qtd | Função | Tópicos |
| --- | --- | --- | --- |
| LED de alto brilho | 6 | iluminação dos cômodos | `<cômodo>/led/state` |
| Display OLED 128x64 | 1 | painel local (Segurança/Cozinha/Ambiente/Acessos) | — |
| NEMA-17 (motor de passo) | 1 | portão da garagem | `garagem/portao/position` |
| Servo SG90 | 1 | porta da sala | `sala/porta/servo_angle` |
| Mini cooler 5V | 1 | exaustor da cozinha | `cozinha/exaustor/state` |
| Buzzer ativo 5V | 1 | alarme | `principal/buzzer/state` |

---

**By:** <a href="https://github.com/benibgw">Benício G. Wendt</a> and <a href="https://github.com/oLima33">Lorenzo F. Lima</a>

---

## TODO

Correções e melhorias pendentes, priorizadas.

### Alta prioridade (funcionamento)
- [x] Corrigir bug do DHT11: quando a leitura inicial for inválida (NaN), o `PublishIfChanged`
  com tolerância nunca publicava o primeiro valor válido. Publicar quando `last` for NaN.
- [x] Adicionar `retain=True` nos publishes de `state` do Script para que o WebSite recupere os
  valores após reiniciar, em vez de mostrar `--`.
- [x] Resolver conflito de Timer5 no Mega: cooler movido para outro timer (Timer3).

### Média prioridade (confiabilidade/UX)
- [x] Corrigir ângulo inicial do servo (publicava ~93° em vez de 0° no boot).
- [x] Tornar o `Stepper.step()` do Nema17 não-bloqueante (passo por frame) para não congelar
  o loop durante o portão.
- [ ] Verificar a polaridade física do MC38 (NO vs NC) — código assume `HIGH` = porta aberta.

### Operacional
- [x] Endurecer a detecção de porta serial no Script com filtro por VID/PID.
- [x] Migrar o Script para `paho-mqtt` `CallbackAPIVersion.VERSION2`.
- [ ] Implementar broker real com autenticação (hoje usa `broker.mqtt.cool` público, só para testes).

> **Notas das correções:**
> - O cooler foi movido para o **pino 5** (Timer3). **Religar o fio do exaustor do pino 44 para o pino 5.**
> - Polos do MC38: com a configuração padrão (NO + `INPUT_PULLUP`), `HIGH` = porta aberta.
>   Se a física estiver invertida (NC), instanciar com `MC38Class(pin, false)` em `Maquete.cpp`.
> - Porta serial configurável por env: `ARDUINO_PORT`, `ARDUINO_VID`, `ARDUINO_PID`
>   (ex.: Mega 16U2 `2341:0043`, CH340 `1A86:7523`).
