#include "Cooler.hpp"

CoolerClass::CoolerClass(uint8_t pin){
    Pin = pin;
    Speed = 255;
    State = false;
    pinMode(Pin, OUTPUT);
}

void CoolerClass::TurnON(){
    analogWrite(Pin, Speed);
    State = true;
}

void CoolerClass::TurnOFF(){
    analogWrite(Pin, 0);
    State = false;
}

void CoolerClass::SetSpeed(uint8_t speed){
    Speed = constrain(speed, 0, 255);
    analogWrite(Pin, Speed);
    State = Speed > 0;
}

uint8_t CoolerClass::GetSpeed(){
    return Speed;
}

bool CoolerClass::GetState(){
    return State;
}