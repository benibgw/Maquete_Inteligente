#pragma once
#include <Arduino.h>

class MHSR602Class{
    public:
        MHSR602Class(uint8_t pin);
        bool GetState();
    private:
        uint8_t Pin;
};