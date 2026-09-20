#include "MC38.hpp"

namespace{
    const uint32_t DebounceWindowMs = 40;
}

MC38Class::MC38Class(uint8_t pin, bool activeHigh){
    Pin = pin;
    ActiveHigh = activeHigh;
    pinMode(Pin, INPUT_PULLUP);
    bool initial = digitalRead(Pin) == HIGH;
    PendingState = initial;
    DebouncedState = initial;
    PendingSince = 0;
}

bool MC38Class::GetState(){
    bool reading = digitalRead(Pin) == HIGH;
    bool raw = ActiveHigh ? reading : !reading;
    uint32_t now = millis();
    if (raw != PendingState){
        PendingState = raw;
        PendingSince = now;
    }
    if (now - PendingSince >= DebounceWindowMs){
        DebouncedState = PendingState;
    }
    return DebouncedState;
}