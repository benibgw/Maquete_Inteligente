#pragma once
#include <Arduino.h>

class CoolerClass{
    public:
        CoolerClass(uint8_t pin);
        void TurnON();
        void TurnOFF();
        void SetSpeed(uint8_t speed);
        uint8_t GetSpeed();
        bool GetState();
    private:
        uint8_t Pin;
        uint8_t Speed;
        bool State;
};