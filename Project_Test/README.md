# Project_Test — Simulador de Arduino via MQTT

Simula o **Firmware** (Arduino Mega 2560) da Maquete Inteligente publicando e consumindo os
tópicos MQTT no mesmo padrão do projeto (`maquete_inteligente/<cômodo>/<componente>/...`).

Serve para testar a integração WebSite ↔ MQTT sem a placa e a fiação conectadas.

## O que o simulador faz

- Publica todos os tópicos de `state` no padrão do firmware, com `retain=True`.
- Publica o heartbeat (`maquete_inteligente/status/online`) **retido** em `true` (no connect e a
  cada 30s), com **LWT** (`false` retido) para o WebSite marcar offline na hora se o simulador
  cair; ao encerrar, publica `false` explicitamente.
- Assina os tópicos `.../command` e aplica as ações, devolvendo o novo estado:
  - `<cômodo>/led/command` → liga/desliga luz (com override manual de 60s)
  - `cozinha/exaustor/command` → liga/desliga exaustor
  - `sala/porta/command` → abre/fecha a porta (anima o ângulo do servo)
  - `garagem/portao/command` → abre/fecha o portão (anima a posição)
  - `principal/alarme/command` → arma/desarma (desarmar limpa disparo e buzzer)
- Roda um cenário automático contínuo:
  - Temperatura e umidade dos DHT11 oscilando suavemente.
  - Luminosidade dos LDRs em ciclo (dia/noite) com regra automática de luzes.
  - Presença intermitente em sala, garagem e pátio.
  - Evento de fumaça na cozinha a cada ~45s (sobe a ~75%, aciona o exaustor e decai).
  - Evento de hall: portão abre sozinho e fecha após 30s.
  - Alarme armado + presença → `triggered` e buzzer disparado.

## Como usar

### 1. Instalar dependências

```bash
cd Project_Test
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Rodar o simulador

```bash
python simulator.py
```

Enquanto isso, rode o WebSite em outro terminal (`WebSite/app.py`) e abra
http://localhost:5000 — os estados aparecem via MQTT.

### Opções

| Argumento | Padrão | Descrição |
| --- | --- | --- |
| `--broker` | `broker.mqtt.cool` (ou env `MQTT_BROKER`) | Endereço do broker MQTT |
| `--port` | `1883` (ou env `MQTT_PORT`) | Porta do broker |
| `--username` / `--password` | env `MQTT_USERNAME`/`MQTT_PASSWORD` | Credenciais MQTT (opcional) |
| `--interval` | `1.0` | Intervalo do tick de simulação (s) |
| `--heartbeat` | `30` | Intervalo do heartbeat (s) |

### Exemplo com broker próprio

```bash
MQTT_BROKER=192.168.0.10 python simulator.py
```

## Observações

- O simulador substitui o `Script/main.py` + Arduino: **não rode os dois ao mesmo tempo**,
  pois publicam nos mesmos tópicos `state`.
- `broker.mqtt.cool` é um broker público de testes, sem autenticação. Use apenas para testes.