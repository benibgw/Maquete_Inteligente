#include "KY003.hpp"

KY003Class::KY003Class(uint8_t pin){
    Pin = pin;
    pinMode(Pin, INPUT);
}

bool KY003Class::GetState(){
    return digitalRead(Pin) == LOW;
}