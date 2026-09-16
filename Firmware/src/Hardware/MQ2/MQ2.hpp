#pragma once
#include <Arduino.h>

class MQ2Class{
    public:
        MQ2Class(uint8_t analogPin, uint8_t digitalPin = 0xFF);
        uint16_t GetRawValue();
        float GetPercentage();
        void SetThreshold(uint16_t threshold);
        bool GetState();
    private:
        uint8_t AnalogPin;
        uint8_t DigitalPin;
        uint16_t Threshold;
};