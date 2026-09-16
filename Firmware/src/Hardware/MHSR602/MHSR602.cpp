#include "MHSR602.hpp"

MHSR602Class::MHSR602Class(uint8_t pin){
    Pin = pin;
    pinMode(Pin, INPUT);
}

bool MHSR602Class::GetState(){
    return digitalRead(Pin) == HIGH;
}