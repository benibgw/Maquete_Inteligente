#include "Maquete.hpp"
#include <ArduinoJson.h>
#include <avr/wdt.h>
#include <math.h>

namespace{
    const uint16_t SensorReadInterval = 2000;
    const uint32_t HeartbeatInterval = 30000;
    const float SensorTolerance = 0.1f;
    const uint16_t Nema17Steps = 200;
    const uint8_t PortaFechadaAngle = 0;
    const uint8_t PortaAbertaAngle = 90;
    const int32_t PortaoFechadoPosition = 0;
    const int32_t PortaoAbertoPosition = 50;
    const float LightOnThreshold = 20.0f;
    const float LightOffThreshold = 50.0f;
    const uint32_t MotionLightTimeout = 30000;
    const uint32_t ManualOverrideDuration = 60000;
    const uint32_t GateCloseDelay = 30000;
    const uint16_t AlarmFrequency = 1000;
    const uint32_t DisplayPageInterval = 5000;
    const uint8_t DisplayPageCount = 4;
    const uint32_t FeriasScheduleInterval = 60000;
}

bool ToBoolean(JsonVariantConst value){
    if (value.is<bool>()){
        return value.as<bool>();
    }
    const char* text = value.as<const char*>();
    if (text != nullptr && strcmp_P(text, PSTR("true")) == 0){
        return true;
    }
    return false;
}

bool ReadSegment(const char*& pos, char* out, uint8_t maxLen){
    uint8_t i = 0;
    while (*pos != '\0' && *pos != '/' && i < maxLen - 1){
        out[i++] = *(pos++);
    }
    out[i] = '\0';
    if (*pos == '/'){
        pos++;
    }
    return i > 0;
}

void ApplyLightRule(uint32_t now, float luminosity, uint32_t lastMotion, uint32_t manualUntil, LedsClass& led){
    if (now < manualUntil){
        return;
    }
    bool darkEnough = luminosity < LightOnThreshold;
    bool brightEnough = luminosity > LightOffThreshold;
    bool motionActive = (lastMotion != 0) && (now - lastMotion < MotionLightTimeout);

    if (brightEnough && !motionActive){
        led.TurnOFF();
    }
    else if (darkEnough || motionActive){
        led.TurnON();
    }
}

void ApplyFeriasRule(uint32_t now, uint32_t manualUntil, uint8_t roomSeed, LedsClass& led){
    if (now < manualUntil){
        return;
    }
    uint32_t bucket = now / FeriasScheduleInterval;
    uint16_t h = (uint16_t)(bucket * 2654435761u + roomSeed * 40503u);
    bool on = (h >> 7) & 1u;
    if (on){
        led.TurnON();
    }
    else{
        led.TurnOFF();
    }
}

MaqueteClass::MaqueteClass()
    : SalaLed(22),
      QuartoLed(23),
      BanheiroLed(24),
      CozinhaLed(25),
      EscritorioLed(26),
      GaragemLed(27),
      SalaLdr(A0),
      QuartoLdr(A1),
      BanheiroLdr(A2),
      CozinhaLdr(A3),
      EscritorioLdr(A4),
      GaragemLdr(A5),
      SalaPortaSensor(28),
      GaragemPortaoSensor(29),
      CozinhaFumacaSensor(A6, 30),
      GaragemHall(31),
      SalaMovimento(32),
      GaragemMovimento(33),
      PatioMovimento(34),
      SalaDht(35),
      QuartoDht(36),
      CozinhaExaustor(5),
      SalaPortaServo(37),
      GaragemPortaoMotor(Nema17Steps, 38, 39, 40, 41),
      Display(),
      Buzzer(42){
    SalaLedState = false;
    QuartoLedState = false;
    BanheiroLedState = false;
    CozinhaLedState = false;
    EscritorioLedState = false;
    GaragemLedState = false;
    SalaPortaState = false;
    GaragemPortaoState = false;
    CozinhaFumacaState = false;
    GaragemHallState = false;
    SalaMovimentoState = false;
    GaragemMovimentoState = false;
    PatioMovimentoState = false;
    CozinhaExaustorState = false;
    AlarmState = false;
    AlarmTriggered = false;
    BuzzerState = false;
    FeriasState = false;

    SalaLuminosity = 0.0f;
    QuartoLuminosity = 0.0f;
    BanheiroLuminosity = 0.0f;
    CozinhaLuminosity = 0.0f;
    EscritorioLuminosity = 0.0f;
    GaragemLuminosity = 0.0f;
    CozinhaFumacaPercentage = 0.0f;
    SalaTemperature = NAN;
    SalaHumidity = NAN;
    QuartoTemperature = NAN;
    QuartoHumidity = NAN;

    SalaPortaAngle = 0;
    GaragemPortaoPosition = 0;

    LastSalaLedState = false;
    LastQuartoLedState = false;
    LastBanheiroLedState = false;
    LastCozinhaLedState = false;
    LastEscritorioLedState = false;
    LastGaragemLedState = false;
    LastSalaPortaState = false;
    LastGaragemPortaoState = false;
    LastCozinhaFumacaState = false;
    LastGaragemHallState = false;
    LastSalaMovimentoState = false;
    LastGaragemMovimentoState = false;
    LastPatioMovimentoState = false;
    LastCozinhaExaustorState = false;
    LastAlarmState = false;
    LastAlarmTriggered = false;
    LastBuzzerState = false;
    LastFeriasState = false;

    LastSalaLuminosity = 0.0f;
    LastQuartoLuminosity = 0.0f;
    LastBanheiroLuminosity = 0.0f;
    LastCozinhaLuminosity = 0.0f;
    LastEscritorioLuminosity = 0.0f;
    LastGaragemLuminosity = 0.0f;
    LastCozinhaFumacaPercentage = 0.0f;
    LastSalaTemperature = NAN;
    LastSalaHumidity = NAN;
    LastQuartoTemperature = NAN;
    LastQuartoHumidity = NAN;

    LastSalaPortaAngle = 0;
    LastGaragemPortaoPosition = 0;

    FirstPublish = true;
    DhtAlternate = false;
    LastSensorRead = 0;
    LastHeartbeat = 0;
    CommandBufferIndex = 0;
    SalaLastMotion = 0;
    GaragemLastMotion = 0;
    PatioLastMotion = 0;
    SalaLedManualUntil = 0;
    QuartoLedManualUntil = 0;
    BanheiroLedManualUntil = 0;
    CozinhaLedManualUntil = 0;
    EscritorioLedManualUntil = 0;
    GaragemLedManualUntil = 0;
    ExaustorManualUntil = 0;
    PortaoCloseAt = 0;
    DisplayPage = 0;
    LastDisplayPageChange = 0;
}

void MaqueteClass::Begin(){
    Serial.begin(9600);
    SalaDht.Begin();
    QuartoDht.Begin();
    Display.Begin();
    Display.ClearShow();
    DrawSecurityPage();
    RefreshSensorState();
    wdt_enable(WDTO_8S);
}

void MaqueteClass::Update(){
    unsigned long now = millis();

    wdt_reset();

    ProcessInbound();

    UpdateFastSensors();

    GaragemPortaoMotor.Update();

    if (now - LastSensorRead >= SensorReadInterval){
        LastSensorRead = now;
        RefreshSensorState();
    }

    ApplyRules();

    PublishDelta();

    UpdateDisplay();

    if (now - LastHeartbeat >= HeartbeatInterval){
        LastHeartbeat = now;
        PublishHeartbeat();
    }
}

void MaqueteClass::UpdateFastSensors(){
    SalaPortaSensor.GetState();
    GaragemPortaoSensor.GetState();
    GaragemHall.GetState();
}

void MaqueteClass::RefreshSensorState(){
    SalaLedState = SalaLed.GetState();
    QuartoLedState = QuartoLed.GetState();
    BanheiroLedState = BanheiroLed.GetState();
    CozinhaLedState = CozinhaLed.GetState();
    EscritorioLedState = EscritorioLed.GetState();
    GaragemLedState = GaragemLed.GetState();

    SalaLuminosity = SalaLdr.GetPercentage();
    QuartoLuminosity = QuartoLdr.GetPercentage();
    BanheiroLuminosity = BanheiroLdr.GetPercentage();
    CozinhaLuminosity = CozinhaLdr.GetPercentage();
    EscritorioLuminosity = EscritorioLdr.GetPercentage();
    GaragemLuminosity = GaragemLdr.GetPercentage();

    SalaPortaState = SalaPortaSensor.GetState();
    GaragemPortaoState = GaragemPortaoSensor.GetState();

    CozinhaFumacaState = CozinhaFumacaSensor.GetState();
    CozinhaFumacaPercentage = CozinhaFumacaSensor.GetPercentage();

    GaragemHallState = GaragemHall.GetState();

    SalaMovimentoState = SalaMovimento.GetState();
    GaragemMovimentoState = GaragemMovimento.GetState();
    PatioMovimentoState = PatioMovimento.GetState();

    if (DhtAlternate){
        QuartoDht.Refresh();
        QuartoTemperature = QuartoDht.GetTemperature();
        QuartoHumidity = QuartoDht.GetHumidity();
    }
    else{
        SalaDht.Refresh();
        SalaTemperature = SalaDht.GetTemperature();
        SalaHumidity = SalaDht.GetHumidity();
    }
    DhtAlternate = !DhtAlternate;

    CozinhaExaustorState = CozinhaExaustor.GetState();
    BuzzerState = Buzzer.GetState();

    SalaPortaAngle = SalaPortaServo.GetAngle();
    GaragemPortaoPosition = GaragemPortaoMotor.GetPosition();
}

void MaqueteClass::ApplyRules(){
    uint32_t now = millis();

    if (SalaMovimentoState){
        SalaLastMotion = now;
    }
    if (GaragemMovimentoState){
        GaragemLastMotion = now;
    }
    if (PatioMovimentoState){
        PatioLastMotion = now;
    }

    if (FeriasState){
        ApplyFeriasRule(now, SalaLedManualUntil, 0, SalaLed);
        ApplyFeriasRule(now, QuartoLedManualUntil, 1, QuartoLed);
        ApplyFeriasRule(now, BanheiroLedManualUntil, 2, BanheiroLed);
        ApplyFeriasRule(now, CozinhaLedManualUntil, 3, CozinhaLed);
        ApplyFeriasRule(now, EscritorioLedManualUntil, 4, EscritorioLed);
        ApplyFeriasRule(now, GaragemLedManualUntil, 5, GaragemLed);
    }
    else{
        ApplyLightRule(now, SalaLuminosity, SalaLastMotion, SalaLedManualUntil, SalaLed);
        ApplyLightRule(now, QuartoLuminosity, 0, QuartoLedManualUntil, QuartoLed);
        ApplyLightRule(now, BanheiroLuminosity, 0, BanheiroLedManualUntil, BanheiroLed);
        ApplyLightRule(now, CozinhaLuminosity, 0, CozinhaLedManualUntil, CozinhaLed);
        ApplyLightRule(now, EscritorioLuminosity, 0, EscritorioLedManualUntil, EscritorioLed);
        ApplyLightRule(now, GaragemLuminosity, GaragemLastMotion, GaragemLedManualUntil, GaragemLed);
    }

    if (now >= ExaustorManualUntil){
        if (CozinhaFumacaState){
            CozinhaExaustor.TurnON();
        }
        else{
            CozinhaExaustor.TurnOFF();
        }
    }

    if (GaragemHallState && !LastGaragemHallState){
        if (GaragemPortaoMotor.GetPosition() != PortaoAbertoPosition){
            SetPortaoPosition(PortaoAbertoPosition);
            PortaoCloseAt = now + GateCloseDelay;
        }
    }

    if (PortaoCloseAt != 0 && now >= PortaoCloseAt){
        PortaoCloseAt = 0;
        if (GaragemPortaoMotor.GetPosition() != PortaoFechadoPosition){
            SetPortaoPosition(PortaoFechadoPosition);
        }
    }

    if (AlarmState){
        bool intrusion = SalaMovimentoState || GaragemMovimentoState || PatioMovimentoState;
        if (intrusion){
            AlarmTriggered = true;
        }
        if (AlarmTriggered){
            Buzzer.PlayTone(AlarmFrequency);
        }
        else{
            Buzzer.StopTone();
        }
    }
    else{
        AlarmTriggered = false;
        Buzzer.StopTone();
    }

    BuzzerState = Buzzer.GetState();
}

void MaqueteClass::ProcessInbound(){
    while (Serial.available()){
        char received = (char)Serial.read();
        if (received == '\n'){
            if (CommandBufferIndex > 0){
                CommandBuffer[CommandBufferIndex] = '\0';
                JsonDocument doc;
                if (!deserializeJson(doc, CommandBuffer)){
                    for (JsonPair pair : doc.as<JsonObject>()){
                        HandleCommand(pair.key().c_str(), ToBoolean(pair.value()));
                    }
                }
            }
            CommandBufferIndex = 0;
        }
        else if (received != '\r' && CommandBufferIndex < CommandLineBufferSize - 1){
            CommandBuffer[CommandBufferIndex] = received;
            CommandBufferIndex++;
        }
    }
}

void MaqueteClass::HandleCommand(const char* topic, bool value){
    char root[20];
    char room[12];
    char component[12];
    char function[12];
    const char* pos = topic;

    if (!ReadSegment(pos, root, sizeof(root))) return;
    if (!ReadSegment(pos, room, sizeof(room))) return;
    if (!ReadSegment(pos, component, sizeof(component))) return;
    if (!ReadSegment(pos, function, sizeof(function))) return;

    if (strcmp_P(root, PSTR("maquete_inteligente")) != 0) return;
    if (strcmp_P(function, PSTR("command")) != 0) return;

    if (strcmp_P(component, PSTR("led")) == 0){
        HandleLedCommand(room, value);
        return;
    }
    if (strcmp_P(component, PSTR("alarme")) == 0){
        HandleAlarmCommand(value);
        return;
    }
    if (strcmp_P(room, PSTR("principal")) == 0 && strcmp_P(component, PSTR("ferias")) == 0){
        HandleFeriasCommand(value);
        return;
    }
    if (strcmp_P(room, PSTR("cozinha")) == 0 && strcmp_P(component, PSTR("exaustor")) == 0){
        HandleExaustorCommand(value);
        return;
    }
    if (strcmp_P(room, PSTR("sala")) == 0 && strcmp_P(component, PSTR("porta")) == 0){
        HandlePortaCommand(value);
        return;
    }
    if (strcmp_P(room, PSTR("garagem")) == 0 && strcmp_P(component, PSTR("portao")) == 0){
        HandlePortaoCommand(value);
        return;
    }
}

void MaqueteClass::HandleLedCommand(const char* room, bool value){
    LedsClass* led = NULL;
    uint32_t* manualUntil = NULL;
    if (strcmp_P(room, PSTR("sala")) == 0){ led = &SalaLed; manualUntil = &SalaLedManualUntil; }
    else if (strcmp_P(room, PSTR("quarto")) == 0){ led = &QuartoLed; manualUntil = &QuartoLedManualUntil; }
    else if (strcmp_P(room, PSTR("banheiro")) == 0){ led = &BanheiroLed; manualUntil = &BanheiroLedManualUntil; }
    else if (strcmp_P(room, PSTR("cozinha")) == 0){ led = &CozinhaLed; manualUntil = &CozinhaLedManualUntil; }
    else if (strcmp_P(room, PSTR("escritorio")) == 0){ led = &EscritorioLed; manualUntil = &EscritorioLedManualUntil; }
    else if (strcmp_P(room, PSTR("garagem")) == 0){ led = &GaragemLed; manualUntil = &GaragemLedManualUntil; }

    if (led != NULL){
        if (value){
            led->TurnON();
        }
        else{
            led->TurnOFF();
        }
        *manualUntil = millis() + ManualOverrideDuration;
    }
}

void MaqueteClass::HandleExaustorCommand(bool value){
    ExaustorManualUntil = millis() + ManualOverrideDuration;
    if (value){
        CozinhaExaustor.TurnON();
    }
    else{
        CozinhaExaustor.TurnOFF();
    }
}

void MaqueteClass::HandleAlarmCommand(bool value){
    AlarmState = value;
    if (!AlarmState){
        AlarmTriggered = false;
        Buzzer.StopTone();
        BuzzerState = false;
    }
}

void MaqueteClass::HandleFeriasCommand(bool value){
    FeriasState = value;
}

void MaqueteClass::HandlePortaCommand(bool value){
    if (value){
        SalaPortaServo.SetAngle(PortaAbertaAngle);
    }
    else{
        SalaPortaServo.SetAngle(PortaFechadaAngle);
    }
}

void MaqueteClass::HandlePortaoCommand(bool value){
    PortaoCloseAt = 0;
    SetPortaoPosition(value ? PortaoAbertoPosition : PortaoFechadoPosition);
}

void MaqueteClass::SetPortaoPosition(int32_t target){
    GaragemPortaoMotor.MoveTo(target);
}

void MaqueteClass::PublishDelta(){
    if (FirstPublish){
        FirstPublish = false;
        PublishAllState();
        return;
    }

    PublishIfChanged(F("maquete_inteligente/sala/led/state"), SalaLedState, LastSalaLedState);
    PublishIfChanged(F("maquete_inteligente/sala/ldr/luminosity"), SalaLuminosity, LastSalaLuminosity, SensorTolerance);
    PublishIfChanged(F("maquete_inteligente/sala/porta/state"), SalaPortaState, LastSalaPortaState);
    if (SalaPortaAngle != LastSalaPortaAngle){
        LastSalaPortaAngle = SalaPortaAngle;
        PublishTopic(F("maquete_inteligente/sala/porta/servo_angle"), (int32_t)SalaPortaAngle);
    }
    PublishIfChanged(F("maquete_inteligente/sala/movimento/state"), SalaMovimentoState, LastSalaMovimentoState);
    if (SalaDht.GetState()){
        PublishIfChanged(F("maquete_inteligente/sala/dht11/temperature"), SalaTemperature, LastSalaTemperature, SensorTolerance);
        PublishIfChanged(F("maquete_inteligente/sala/dht11/humidity"), SalaHumidity, LastSalaHumidity, SensorTolerance);
    }

    PublishIfChanged(F("maquete_inteligente/quarto/led/state"), QuartoLedState, LastQuartoLedState);
    PublishIfChanged(F("maquete_inteligente/quarto/ldr/luminosity"), QuartoLuminosity, LastQuartoLuminosity, SensorTolerance);
    if (QuartoDht.GetState()){
        PublishIfChanged(F("maquete_inteligente/quarto/dht11/temperature"), QuartoTemperature, LastQuartoTemperature, SensorTolerance);
        PublishIfChanged(F("maquete_inteligente/quarto/dht11/humidity"), QuartoHumidity, LastQuartoHumidity, SensorTolerance);
    }

    PublishIfChanged(F("maquete_inteligente/banheiro/led/state"), BanheiroLedState, LastBanheiroLedState);
    PublishIfChanged(F("maquete_inteligente/banheiro/ldr/luminosity"), BanheiroLuminosity, LastBanheiroLuminosity, SensorTolerance);

    PublishIfChanged(F("maquete_inteligente/cozinha/led/state"), CozinhaLedState, LastCozinhaLedState);
    PublishIfChanged(F("maquete_inteligente/cozinha/ldr/luminosity"), CozinhaLuminosity, LastCozinhaLuminosity, SensorTolerance);
    PublishIfChanged(F("maquete_inteligente/cozinha/fumaca/state"), CozinhaFumacaState, LastCozinhaFumacaState);
    PublishIfChanged(F("maquete_inteligente/cozinha/fumaca/percentage"), CozinhaFumacaPercentage, LastCozinhaFumacaPercentage, SensorTolerance);
    PublishIfChanged(F("maquete_inteligente/cozinha/exaustor/state"), CozinhaExaustorState, LastCozinhaExaustorState);

    PublishIfChanged(F("maquete_inteligente/escritorio/led/state"), EscritorioLedState, LastEscritorioLedState);
    PublishIfChanged(F("maquete_inteligente/escritorio/ldr/luminosity"), EscritorioLuminosity, LastEscritorioLuminosity, SensorTolerance);

    PublishIfChanged(F("maquete_inteligente/garagem/led/state"), GaragemLedState, LastGaragemLedState);
    PublishIfChanged(F("maquete_inteligente/garagem/ldr/luminosity"), GaragemLuminosity, LastGaragemLuminosity, SensorTolerance);
    PublishIfChanged(F("maquete_inteligente/garagem/portao/state"), GaragemPortaoState, LastGaragemPortaoState);
    if (GaragemPortaoPosition != LastGaragemPortaoPosition){
        LastGaragemPortaoPosition = GaragemPortaoPosition;
        PublishTopic(F("maquete_inteligente/garagem/portao/position"), GaragemPortaoPosition);
    }
    PublishIfChanged(F("maquete_inteligente/garagem/hall/state"), GaragemHallState, LastGaragemHallState);
    PublishIfChanged(F("maquete_inteligente/garagem/movimento/state"), GaragemMovimentoState, LastGaragemMovimentoState);

    PublishIfChanged(F("maquete_inteligente/patio/movimento/state"), PatioMovimentoState, LastPatioMovimentoState);

    PublishIfChanged(F("maquete_inteligente/principal/alarme/state"), AlarmState, LastAlarmState);
    PublishIfChanged(F("maquete_inteligente/principal/alarme/triggered"), AlarmTriggered, LastAlarmTriggered);
    PublishIfChanged(F("maquete_inteligente/principal/buzzer/state"), BuzzerState, LastBuzzerState);
    PublishIfChanged(F("maquete_inteligente/principal/ferias/state"), FeriasState, LastFeriasState);
}

void MaqueteClass::PublishAllState(){
    PublishTopic(F("maquete_inteligente/sala/led/state"), SalaLedState);
    LastSalaLedState = SalaLedState;
    PublishTopic(F("maquete_inteligente/sala/ldr/luminosity"), SalaLuminosity, 1);
    LastSalaLuminosity = SalaLuminosity;
    PublishTopic(F("maquete_inteligente/sala/porta/state"), SalaPortaState);
    LastSalaPortaState = SalaPortaState;
    PublishTopic(F("maquete_inteligente/sala/porta/servo_angle"), (int32_t)SalaPortaAngle);
    LastSalaPortaAngle = SalaPortaAngle;
    PublishTopic(F("maquete_inteligente/sala/movimento/state"), SalaMovimentoState);
    LastSalaMovimentoState = SalaMovimentoState;
    if (SalaDht.GetState()){
        PublishTopic(F("maquete_inteligente/sala/dht11/temperature"), SalaTemperature, 1);
        LastSalaTemperature = SalaTemperature;
        PublishTopic(F("maquete_inteligente/sala/dht11/humidity"), SalaHumidity, 1);
        LastSalaHumidity = SalaHumidity;
    }

    PublishTopic(F("maquete_inteligente/quarto/led/state"), QuartoLedState);
    LastQuartoLedState = QuartoLedState;
    PublishTopic(F("maquete_inteligente/quarto/ldr/luminosity"), QuartoLuminosity, 1);
    LastQuartoLuminosity = QuartoLuminosity;
    if (QuartoDht.GetState()){
        PublishTopic(F("maquete_inteligente/quarto/dht11/temperature"), QuartoTemperature, 1);
        LastQuartoTemperature = QuartoTemperature;
        PublishTopic(F("maquete_inteligente/quarto/dht11/humidity"), QuartoHumidity, 1);
        LastQuartoHumidity = QuartoHumidity;
    }

    PublishTopic(F("maquete_inteligente/banheiro/led/state"), BanheiroLedState);
    LastBanheiroLedState = BanheiroLedState;
    PublishTopic(F("maquete_inteligente/banheiro/ldr/luminosity"), BanheiroLuminosity, 1);
    LastBanheiroLuminosity = BanheiroLuminosity;

    PublishTopic(F("maquete_inteligente/cozinha/led/state"), CozinhaLedState);
    LastCozinhaLedState = CozinhaLedState;
    PublishTopic(F("maquete_inteligente/cozinha/ldr/luminosity"), CozinhaLuminosity, 1);
    LastCozinhaLuminosity = CozinhaLuminosity;
    PublishTopic(F("maquete_inteligente/cozinha/fumaca/state"), CozinhaFumacaState);
    LastCozinhaFumacaState = CozinhaFumacaState;
    PublishTopic(F("maquete_inteligente/cozinha/fumaca/percentage"), CozinhaFumacaPercentage, 1);
    LastCozinhaFumacaPercentage = CozinhaFumacaPercentage;
    PublishTopic(F("maquete_inteligente/cozinha/exaustor/state"), CozinhaExaustorState);
    LastCozinhaExaustorState = CozinhaExaustorState;

    PublishTopic(F("maquete_inteligente/escritorio/led/state"), EscritorioLedState);
    LastEscritorioLedState = EscritorioLedState;
    PublishTopic(F("maquete_inteligente/escritorio/ldr/luminosity"), EscritorioLuminosity, 1);
    LastEscritorioLuminosity = EscritorioLuminosity;

    PublishTopic(F("maquete_inteligente/garagem/led/state"), GaragemLedState);
    LastGaragemLedState = GaragemLedState;
    PublishTopic(F("maquete_inteligente/garagem/ldr/luminosity"), GaragemLuminosity, 1);
    LastGaragemLuminosity = GaragemLuminosity;
    PublishTopic(F("maquete_inteligente/garagem/portao/state"), GaragemPortaoState);
    LastGaragemPortaoState = GaragemPortaoState;
    PublishTopic(F("maquete_inteligente/garagem/portao/position"), GaragemPortaoPosition);
    LastGaragemPortaoPosition = GaragemPortaoPosition;
    PublishTopic(F("maquete_inteligente/garagem/hall/state"), GaragemHallState);
    LastGaragemHallState = GaragemHallState;
    PublishTopic(F("maquete_inteligente/garagem/movimento/state"), GaragemMovimentoState);
    LastGaragemMovimentoState = GaragemMovimentoState;

    PublishTopic(F("maquete_inteligente/patio/movimento/state"), PatioMovimentoState);
    LastPatioMovimentoState = PatioMovimentoState;

    PublishTopic(F("maquete_inteligente/principal/alarme/state"), AlarmState);
    LastAlarmState = AlarmState;
    PublishTopic(F("maquete_inteligente/principal/alarme/triggered"), AlarmTriggered);
    LastAlarmTriggered = AlarmTriggered;
    PublishTopic(F("maquete_inteligente/principal/buzzer/state"), BuzzerState);
    LastBuzzerState = BuzzerState;
    PublishTopic(F("maquete_inteligente/principal/ferias/state"), FeriasState);
    LastFeriasState = FeriasState;
}

void MaqueteClass::PublishHeartbeat(){
    PublishTopic(F("maquete_inteligente/status/online"), true);
}

void MaqueteClass::PublishTopic(const __FlashStringHelper* topic, bool value){
    JsonDocument doc;
    doc[topic] = value;
    serializeJson(doc, Serial);
    Serial.println();
}

void MaqueteClass::PublishTopic(const __FlashStringHelper* topic, float value, uint8_t decimals){
    float factor = powf(10.0f, decimals);
    value = roundf(value * factor) / factor;
    JsonDocument doc;
    doc[topic] = value;
    serializeJson(doc, Serial);
    Serial.println();
}

void MaqueteClass::PublishTopic(const __FlashStringHelper* topic, int32_t value){
    JsonDocument doc;
    doc[topic] = value;
    serializeJson(doc, Serial);
    Serial.println();
}

void MaqueteClass::PublishIfChanged(const __FlashStringHelper* topic, bool value, bool& last){
    if (value != last){
        last = value;
        PublishTopic(topic, value);
    }
}

void MaqueteClass::PublishIfChanged(const __FlashStringHelper* topic, float value, float& last, float tolerance){
    if (isnan(value)){
        return;
    }
    if (isnan(last) || fabsf(value - last) >= tolerance){
        last = value;
        PublishTopic(topic, value, 1);
    }
}

void MaqueteClass::UpdateDisplay(){
    uint32_t now = millis();
    if (now - LastDisplayPageChange >= DisplayPageInterval){
        LastDisplayPageChange = now;
        DisplayPage = (DisplayPage + 1) % DisplayPageCount;
        Display.ClearShow();
        switch (DisplayPage){
            case 0: DrawSecurityPage(); break;
            case 1: DrawKitchenPage(); break;
            case 2: DrawAmbientPage(); break;
            case 3: DrawAccessPage(); break;
        }
    }
}

void MaqueteClass::PrintDisplayTitle(const char* text){
    Display.SetTextSize(2);
    Display.SetCursor((128 - strlen(text) * 12) / 2, 0);
    Display.PrintText(text);
    Display.SetTextSize(1);
}

void MaqueteClass::PrintDisplayBool(uint8_t row, const char* label, bool value, const char* yes, const char* no){
    Display.SetCursor(0, row * 8);
    Display.PrintText(label);
    Display.PrintText(value ? yes : no);
}

void MaqueteClass::PrintTempHumidityRow(uint8_t row, const char* label, bool valid, float temp, float humi){
    Display.SetCursor(0, row * 8);
    Display.PrintText(label);
    if (valid){
        Display.PrintFloat(temp, 1);
        Display.PrintText("C   ");
        Display.PrintInt((int32_t)humi);
        Display.PrintText("%");
    }
    else{
        Display.PrintText("--C   --%");
    }
}

void MaqueteClass::DrawSecurityPage(){
    PrintDisplayTitle("SEGURANCA");
    PrintDisplayBool(2, "Alarme:  ", AlarmState, "ARMADO", "DESARMADO");
    PrintDisplayBool(3, "Disparo: ", AlarmTriggered, "SIM", "NAO");
    PrintDisplayBool(4, "Sala:    ", SalaMovimentoState, "SIM", "NAO");
    PrintDisplayBool(5, "Garagem: ", GaragemMovimentoState, "SIM", "NAO");
    PrintDisplayBool(6, "Patio:   ", PatioMovimentoState, "SIM", "NAO");
    PrintDisplayBool(7, "Ferias:  ", FeriasState, "ON", "OFF");
}

void MaqueteClass::DrawKitchenPage(){
    PrintDisplayTitle("COZINHA");
    Display.SetCursor(0, 16);
    Display.PrintText("Fumaca:  ");
    Display.PrintFloat(CozinhaFumacaPercentage, 1);
    Display.PrintText("%");
    PrintDisplayBool(3, "Estado:  ", CozinhaFumacaState, "SIM", "NAO");
    PrintDisplayBool(4, "Exaustor:", CozinhaExaustorState, "ON", "OFF");
}

void MaqueteClass::DrawAmbientPage(){
    PrintDisplayTitle("AMBIENTE");
    PrintTempHumidityRow(2, "Sala   ", SalaDht.GetState(), SalaTemperature, SalaHumidity);
    PrintTempHumidityRow(3, "Quarto ", QuartoDht.GetState(), QuartoTemperature, QuartoHumidity);
}

void MaqueteClass::DrawAccessPage(){
    PrintDisplayTitle("ACESSOS");
    PrintDisplayBool(2, "Porta:  ", SalaPortaState, "ABERTA", "FECHADA");
    PrintDisplayBool(3, "Portao: ", GaragemPortaoState, "ABERTA", "FECHADA");
    PrintDisplayBool(4, "Hall:   ", GaragemHallState, "SIM", "NAO");
}