#include "Buzzers.hpp"

BuzzersClass::BuzzersClass(uint8_t pin){
    Pin = pin;
    pinMode(Pin, OUTPUT);
}

void BuzzersClass::PlayTone(uint16_t frequency){
    tone(Pin, frequency);
    State = true;
}

void BuzzersClass::StopTone(){
    noTone(Pin);
    State = false;
}

bool BuzzersClass::GetState(){
    return State;
}