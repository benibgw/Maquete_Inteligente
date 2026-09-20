#pragma once
#include <Arduino.h>

class KY003Class{
    public:
        KY003Class(uint8_t pin);
        bool GetState();
    private:
        uint8_t Pin;
        bool PendingState;
        bool DebouncedState;
        uint32_t PendingSince;
};