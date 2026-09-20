#include "KY003.hpp"

namespace{
    const uint32_t DebounceWindowMs = 40;
}

KY003Class::KY003Class(uint8_t pin){
    Pin = pin;
    pinMode(Pin, INPUT);
    PendingState = digitalRead(Pin) == LOW;
    DebouncedState = PendingState;
    PendingSince = 0;
}

bool KY003Class::GetState(){
    bool raw = digitalRead(Pin) == LOW;
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