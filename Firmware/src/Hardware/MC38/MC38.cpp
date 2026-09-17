#include "MC38.hpp"

MC38Class::MC38Class(uint8_t pin){
    Pin = pin;
    pinMode(Pin, INPUT_PULLUP);
}

bool MC38Class::GetState(){
    return digitalRead(Pin) == HIGH;
}