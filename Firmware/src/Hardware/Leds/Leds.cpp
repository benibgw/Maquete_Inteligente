#include "Leds.hpp"

LedsClass::LedsClass(uint8_t pin){
    Pin = pin;
    pinMode(Pin, OUTPUT);
}

void LedsClass::TurnON(){
    digitalWrite(Pin, HIGH);
}

void LedsClass::TurnOFF(){
    digitalWrite(Pin, LOW);
}

bool LedsClass::GetState(){
    return digitalRead(Pin);
}