#include "LDR.hpp"

LDRClass::LDRClass(uint8_t analogPin){
    AnalogPin = analogPin;
    pinMode(AnalogPin, INPUT);
}

uint16_t LDRClass::GetRawValue(){
    return analogRead(AnalogPin);
}

float LDRClass::GetPercentage(){
    return (analogRead(AnalogPin) / 1023.0f) * 100.0f;
}