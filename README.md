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

Todo o sistema de gerenciamento será por meio de um site que pode ser acessado pelo celular ou notebook, sendo construído com base em um Arduino UNO, programação em HTML, CSS, Python, C++ e JavaScript.

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

## Principais sensores

### 1. MH-SR602(ou semelhante) — Sensor de presença

Detecta movimento/presença de pessoas.

**Exemplo:**
- Pessoa entra na sala
- MH-SR602 detecta presença
- ESP32 acende o LED da sala

**Quantidade: 3**

---

### 2. DHT22(ou semelhante) — Temperatura e umidade

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

**Quantidade: 8**

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

**Quantidade: 5**

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
