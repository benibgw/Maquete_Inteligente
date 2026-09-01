#pragma once
#include <Arduino.h>

class BuzzersClass{
    public:
        BuzzersClass(uint8_t pin);
        void PlayTone(uint16_t frequency);
        void StopTone();
        bool GetState();
    private:
        uint8_t Pin;
        bool State;
};