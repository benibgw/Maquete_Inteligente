#pragma once
#include <Arduino.h>

class LDRClass{
    public:
        LDRClass(uint8_t analogPin);
        uint16_t GetRawValue();
        float GetPercentage();
    private:
        uint8_t AnalogPin;
};