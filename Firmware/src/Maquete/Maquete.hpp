#pragma once
#include <Arduino.h>

#include "Hardware/Leds/Leds.hpp"
#include "Hardware/Buzzers/Buzzers.hpp"
#include "Hardware/Servos/Servos.hpp"
#include "Hardware/MQ2/MQ2.hpp"
#include "Hardware/DHT11/DHT11.hpp"
#include "Hardware/MHSR602/MHSR602.hpp"
#include "Hardware/KY003/KY003.hpp"
#include "Hardware/MC38/MC38.hpp"
#include "Hardware/LDR/LDR.hpp"
#include "Hardware/Cooler/Cooler.hpp"
#include "Hardware/Nema17/Nema17.hpp"
#include "Hardware/Display/Display.hpp"

class MaqueteClass{
    public:
        MaqueteClass();
        void Begin();
        void Update();
    private:
        enum { CommandLineBufferSize = 64 };

        void RefreshSensorState();
        void ApplyRules();
        void ProcessInbound();
        void HandleCommand(const char* topic, bool value);
        void HandleLedCommand(const char* room, bool value);
        void HandleExaustorCommand(bool value);
        void HandlePortaCommand(bool value);
        void HandlePortaoCommand(bool value);
        void HandleAlarmCommand(bool value);
        void HandleFeriasCommand(bool value);
        void SetPortaoPosition(int32_t target);
        void UpdateDisplay();
        void DrawSecurityPage();
        void DrawKitchenPage();
        void DrawAmbientPage();
        void DrawAccessPage();
        void PrintDisplayTitle(const char* text);
        void PrintDisplayBool(uint8_t row, const char* label, bool value, const char* yes, const char* no);
        void PrintTempHumidityRow(uint8_t row, const char* label, bool valid, float temp, float humi);
        void PublishDelta();
        void PublishAllState();
        void PublishHeartbeat();
        void PublishTopic(const __FlashStringHelper* topic, bool value);
        void PublishTopic(const __FlashStringHelper* topic, float value, uint8_t decimals);
        void PublishTopic(const __FlashStringHelper* topic, int32_t value);
        void PublishIfChanged(const __FlashStringHelper* topic, bool value, bool& last);
        void PublishIfChanged(const __FlashStringHelper* topic, float value, float& last, float tolerance);

        LedsClass SalaLed;
        LedsClass QuartoLed;
        LedsClass BanheiroLed;
        LedsClass CozinhaLed;
        LedsClass EscritorioLed;
        LedsClass GaragemLed;
        LDRClass SalaLdr;
        LDRClass QuartoLdr;
        LDRClass BanheiroLdr;
        LDRClass CozinhaLdr;
        LDRClass EscritorioLdr;
        LDRClass GaragemLdr;
        MC38Class SalaPortaSensor;
        MC38Class GaragemPortaoSensor;
        MQ2Class CozinhaFumacaSensor;
        KY003Class GaragemHall;
        MHSR602Class SalaMovimento;
        MHSR602Class GaragemMovimento;
        MHSR602Class PatioMovimento;
        DHT11Class SalaDht;
        DHT11Class QuartoDht;
        CoolerClass CozinhaExaustor;
        ServosClass SalaPortaServo;
        Nema17Class GaragemPortaoMotor;
        DisplayClass Display;
        BuzzersClass Buzzer;

        bool SalaLedState;
        bool QuartoLedState;
        bool BanheiroLedState;
        bool CozinhaLedState;
        bool EscritorioLedState;
        bool GaragemLedState;
        bool SalaPortaState;
        bool GaragemPortaoState;
        bool CozinhaFumacaState;
        bool GaragemHallState;
        bool SalaMovimentoState;
        bool GaragemMovimentoState;
        bool PatioMovimentoState;
        bool CozinhaExaustorState;
        bool AlarmState;
        bool AlarmTriggered;
        bool BuzzerState;
        bool FeriasState;

        float SalaLuminosity;
        float QuartoLuminosity;
        float BanheiroLuminosity;
        float CozinhaLuminosity;
        float EscritorioLuminosity;
        float GaragemLuminosity;
        float CozinhaFumacaPercentage;
        float SalaTemperature;
        float SalaHumidity;
        float QuartoTemperature;
        float QuartoHumidity;

        uint8_t SalaPortaAngle;
        int32_t GaragemPortaoPosition;

        bool LastSalaLedState;
        bool LastQuartoLedState;
        bool LastBanheiroLedState;
        bool LastCozinhaLedState;
        bool LastEscritorioLedState;
        bool LastGaragemLedState;
        bool LastSalaPortaState;
        bool LastGaragemPortaoState;
        bool LastCozinhaFumacaState;
        bool LastGaragemHallState;
        bool LastSalaMovimentoState;
        bool LastGaragemMovimentoState;
        bool LastPatioMovimentoState;
        bool LastCozinhaExaustorState;
        bool LastAlarmState;
        bool LastAlarmTriggered;
        bool LastBuzzerState;
        bool LastFeriasState;

        float LastSalaLuminosity;
        float LastQuartoLuminosity;
        float LastBanheiroLuminosity;
        float LastCozinhaLuminosity;
        float LastEscritorioLuminosity;
        float LastGaragemLuminosity;
        float LastCozinhaFumacaPercentage;
        float LastSalaTemperature;
        float LastSalaHumidity;
        float LastQuartoTemperature;
        float LastQuartoHumidity;

        uint8_t LastSalaPortaAngle;
        int32_t LastGaragemPortaoPosition;

        bool FirstPublish;
        bool DhtAlternate;
        unsigned long LastSensorRead;
        unsigned long LastHeartbeat;
        char CommandBuffer[CommandLineBufferSize];
        uint8_t CommandBufferIndex;

        uint32_t SalaLastMotion;
        uint32_t GaragemLastMotion;
        uint32_t PatioLastMotion;
        uint32_t SalaLedManualUntil;
        uint32_t QuartoLedManualUntil;
        uint32_t BanheiroLedManualUntil;
        uint32_t CozinhaLedManualUntil;
        uint32_t EscritorioLedManualUntil;
        uint32_t GaragemLedManualUntil;
        uint32_t ExaustorManualUntil;
        uint32_t PortaoCloseAt;

        uint8_t DisplayPage;
        unsigned long LastDisplayPageChange;
};