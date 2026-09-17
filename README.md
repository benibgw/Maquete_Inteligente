# Projeto IoT — Maquete de Casa Inteligente — Osguri Cap

<p align="center">
  <img src="https://preview.redd.it/why-oguri-cap-is-famous-v0-ai58vhjykoif1.png?width=640&crop=smart&auto=webp&s=7726a01f7fee8debfeda6c3fb79920ed6e064988" alt="Oguri Cap" />
</p>

---

Maquete de uma casa inteligente controlada por um site acessível pelo celular ou notebook.
Sensores e atuadores são gerenciados por um **Arduino Mega 2560**; a comunicação entre as
partes acontece por **MQTT**, com uma ponte **Serial**.

## Estrutura lógica

Quando acionada, o usuário pode controlar diversas funções na maquete:
- Acionar luzes dos cômodos
- Ativar atuadores (servo motores, display, portão)

Funções automáticas também são executadas a partir da leitura de sensores:
- Temperatura e umidade
- Detecção de fumaça/gás
- Intensidade luminosa
- Detecção de presença
- Sensores magnéticos e de campo (Hall)

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

## Módulos do repositório

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
`cozinha/exaustor`, `sala/porta`, `garagem/portao`, `principal/alarme` e `principal/buzzer`.

**Exemplo:** `maquete_inteligente/sala/led/state` (estado da luz) e
`maquete_inteligente/sala/led/command` (ligar/desligar).

## Principais sensores

### 1. MH-SR602 (ou semelhante) — Sensor de presença

Detecta movimento/presença de pessoas.

**Exemplo:**
- Pessoa entra na sala
- MH-SR602 detecta presença
- O firmware acende o LED da sala

**Quantidade: 3**

---

### 2. DHT11 (ou semelhante) — Temperatura e umidade

Mede:
- Temperatura
- Umidade relativa do ar

**Exemplo:**
- Temperatura > 27 °C
- O firmware liga o ventilador

**Quantidade: 2**

---

### 3. LDR — Sensor de luminosidade

Detecta a intensidade de luz do ambiente.

**Exemplo:**
- Está escuro
- Há uma pessoa na sala
- O firmware acende a iluminação

**Quantidade: 6**

---

### 4. MQ-2 (ou semelhante) — Gás e fumaça

Utilizado como sistema de segurança na cozinha.

**Exemplo:**
- MQ-2 detecta gás/fumaça
- LED vermelho acende
- Buzzer dispara
- Sistema envia um alerta

**Quantidade: 1**

---

### 5. KY-003 (ou semelhante) — Sensor Hall

Mede a intensidade do campo magnético.

**Exemplo na garagem:**
- Carro se aproxima
- KY-003 detecta o ímã do veículo
- O firmware abre o portão (motor de passo)

**Quantidade: 1**

---

### 6. MC-38 (ou semelhante) — Sensor magnético

Pode ser instalado em portas e janelas para detectar abertura.

**Exemplo:**
- Porta é aberta
- MC-38 muda de estado
- O firmware registra a abertura
- Em modo de segurança, o sistema dispara um alarme

**Quantidade: 2**

---

## Principais atuadores

### 1. LED de alto brilho

Utilizado como meio de iluminação.

**Exemplo:**
- Luz do quarto
- Luz da sala

**Quantidade: 6**

---

### 2. Display LCD 128x64

Utilizado como dispositivo de visualização de dados.

**Exemplo:**
- Painel de controle central inteligente
- Alterna entre as páginas: Segurança, Cozinha, Ambiente e Acessos

**Quantidade: 1**

---

### 3. NEMA-17 (ou semelhante) — Motor de passo

Utilizado para movimentar partes móveis pesadas.

**Exemplo:**
- Portão da garagem

**Quantidade: 1**

---

### 4. SG90 (ou semelhante) — Micro servo motor

Utilizado para movimentar partes móveis leves.

**Exemplo:**
- Portas
- Janelas

**Quantidade: 1**

---

### 5. Mini Cooler 5V

**Exemplo:**
- Exaustor na cozinha
- Ventilador

**Quantidade: 1**

---

### 6. Buzzer Ativo 5V

Utilizado para emitir sons.

**Exemplo:**
- Alarme

**Quantidade: 1**

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
