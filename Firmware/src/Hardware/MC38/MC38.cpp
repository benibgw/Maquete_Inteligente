#include "MC38.hpp"

MC38Class::MC38Class(uint8_t pin, bool activeHigh){
    Pin = pin;
    ActiveHigh = activeHigh;
    pinMode(Pin, INPUT_PULLUP);
}

bool MC38Class::GetState(){
    bool reading = digitalRead(Pin) == HIGH;
    return ActiveHigh ? reading : !reading;
}