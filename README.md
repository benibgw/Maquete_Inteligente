# Projeto IoT — Maquete de Casa Inteligente — Osguri Cap

<p align="center">
  <img src="https://preview.redd.it/why-oguri-cap-is-famous-v0-ai58vhjykoif1.png?width=640&crop=smart&auto=webp&s=7726a01f7fee8debfeda6c3fb79920ed6e064988" alt="Oguri Cap" />
</p>

---

## Estrutura lógica

Quando acionada, o usuário poderá controlar diversas funções na maquete:
- Acionar luzes dos comodos
- Ativar atuadores(servo motores, displays)

Funções autométicas também serão iniciadas como a leitura de sensores:
- de temperatura e umidade
- detecção de fumaça
- intensidade luminosa
- detecção de presença
- magnéticos

Todo o sistema de gerenciamento será por meio de um site que pode ser acessado pelo celular ou notebook, sendo construído com base em um Arduino Mega 2560, programação em HTML, CSS, Python, C++ e JavaScript.

---

## Estrutura física

A maquete será contruida com MDF 20mm, seguindo o módelo de uma casa moderna de dois andáres, com um dos lados expostos, contando com:
- 2 quartos
- Sala de estar
- Cozinha
- Banheiro
- Garagem
- Pátio frontal

Utilizaremos outros tipos de matériais complementares para a contrução de móveis e estruturas, táis como:
- Impressão 3D
- Acrilico
- Vidro
- Alumínio

## Comunicação / Arquitetura

O sistema é dividido em três módulos que se comunicam por um Broker MQTT:

```
Navegador (celular/notebook)
        │ HTTP (poll /api/state, comando /api/command)
        ▼
WebSite (Flask + paho-mqtt)  ──────┐
        ▲                        MQTT
        │ tópicos /state          ▼
Broker MQTT (broker.mqtt.cool)
        ▲ MQTT tópicos /state     │
        │                         ▼
Script (Pyserial + paho-mqtt) ──────┘
        ▲ Serial 9600 (JSON por linha)
        ▼
Firmware (Arduino Mega 2560, C++)
```

- **Firmware**: lê os sensores e aciona os atuadores, publicando o estado pela Serial em JSON (um tópico por linha) e recebendo comandos no mesmo canal.
- **Script** (`Script/main.py`): ponte entre a Serial e o Broker MQTT — repassa comandos para o firmware e publica o estado no broker.
- **WebSite** (`WebSite/app.py`): assina os tópicos do broker, mantém o estado atualizado e expõe uma interface web para monitoramento e controle.
- **Broker MQTT**: usado somente para testes (`broker.mqtt.cool`), será substituído por um broker real futuramente.

### Convenção de tópicos

Todos os tópicos usam o root `maquete_inteligente`:

- `maquete_inteligente/<cômodo>/<componente>/state` — telemetria (estado de sensores/atuadores)
- `maquete_inteligente/<cômodo>/<componente>/command` — controle (comandos do usuário)

**Exemplo:** `maquete_inteligente/sala/led/state` (estado da luz) e `maquete_inteligente/sala/led/command` (ligar/desligar).

## Principais sensores

### 1. MH-SR602(ou semelhante) — Sensor de presença

Detecta movimento/presença de pessoas.

**Exemplo:**
- Pessoa entra na sala
- MH-SR602 detecta presença
- ESP32 acende o LED da sala

**Quantidade: 3**

---

### 2. DHT11(ou semelhante) — Temperatura e umidade

Mede:
- Temperatura
- Umidade relativa do ar

**Exemplo:**
- Temperatura > 27 °C
- ESP32 liga o ventilador

**Quantidade: 2**

---

### 3. LDR — Sensor de luminosidade

Detecta a intensidade de luz do ambiente.

**Exemplo:**
- Está escuro
- Há uma pessoa na sala
- ESP32 acende a iluminação

**Quantidade: 6**

---

### 4. MQ-2(ou semelhante) — Gás e fumaça

Pode ser utilizado para representar um sistema de segurança na cozinha.

**Exemplo:**
- MQ-2 detecta gás/fumaça
- LED vermelho acende
- Buzzer dispara
- Sistema envia um alerta

**Quantidade: 1**

---

### 5. KY-003(ou semelhante) — Sensor Hall

Mede a intensidade do campo magnético.

**Exemplo na garagem:**
- Carro se aproxima
- HC-SR04 detecta o veículo
- Servo motor abre o portão

**Quantidade: 1**

---

### 6. MC-38(ou semelhante) — Sensor magnético

Pode ser instalado em portas e janelas para detectar abertura.

**Exemplo:**
- Porta é aberta
- MC-38 muda de estado
- ESP32 registra a abertura
- Em modo de segurança, o sistema dispara um alarme

**Quantidade: 2**

---

## Principais atuadores

### 1. LED de alto brilho

Será utlitizado como meio de iluminação.

**Exemplo:**
- Luz do quarto
- Luz da sala

**Quantidade: 6**

---

### 2. Display LCD 128x64

Será utilizado como dispositivo de visualização de dados.

**Exemplo:**
- Painel de controle central inteligênte

**Quantidade: 1**

---

### 3. NEMA-17(ou semelhante) — Motor de passo

Utilizado para movimentar partes móveis pesadas.

**Exemplo:**
- Portão da garagem

**Quantidade: 1**

---

### 4. Sg90(ou semelhante) — Micro servo motor

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

Correções e melhorias pendentes, priorizadas:

### Alta prioridade (funcionamento)
- [x] Corrigir bug do DHT11: quando a leitura inicial for inválida (NaN), o `PublishIfChanged` com tolerância nunca publica o primeiro valor válido (`Firmware/src/Maquete/Maquete.cpp:601-609`). Publicar quando `last` for NaN.
- [x] Adicionar `retain=True` nos publishes de `state` do Script (ou republicar estado completo periodicamente) para que o WebSite recupere os valores após reiniciar, em vez de mostrar `--`.
- [x] Resolver conflito de Timer5 no Mega: cooler usa `analogWrite(44)` (Timer5C) e a lib Servo ocupa o Timer5. Mover o cooler para outro timer (ex.: Timer3/4) ou `detach()` do servo quando ocioso.

### Média prioridade (confiabilidade/UX)
- [x] Corrigir ângulo inicial do servo (publica ~93° em vez de 0° no boot) — gravar `write(0)` no attach ou usar o membro `Angle`.
- [x] Tornar o `Stepper.step()` do Nema17 não-bloqueante (passo por frame) para não congelar o loop durante o portão.
- [ ] Verificar a polaridade física do MC38 (NO vs NC) — código assume `HIGH` = porta aberta.

### Operacional
- [x] Endurecer a detecção de porta serial no Script (`Script/main.py:15-20`) com filtro por VID/PID ao lidar com múltiplos dispositivos USB.
- [x] Migrar o Script para `paho-mqtt` `CallbackAPIVersion.VERSION2` (hoje usa V1, deprecation warning).
- [ ] Implementar broker real com autenticação (hoje usa `broker.mqtt.cool` público, só para testes).

> **Notas das correções:**
> - O cooler foi movido para o **pino 5** (Timer3). **Religar o fio do exaustor do pino 44 para o pino 5.**
> - Polos do MC38: com a configuração padrão (NO + `INPUT_PULLUP`), `HIGH` = porta aberta. Se a física estiver invertida (NC), instanciar com `MC38Class(pin, false)` em `Maquete.cpp:65-66`.
> - Porta serial configurável por env: `ARDUINO_PORT`, `ARDUINO_VID`, `ARDUINO_PID` (ex.: Mega 16U2 `2341:0043`, CH340 `1A86:7523`).
