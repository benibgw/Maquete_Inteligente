#pragma once
#include <Arduino.h>

class MC38Class{
    public:
        MC38Class(uint8_t pin);
        bool GetState();
    private:
        uint8_t Pin;
};