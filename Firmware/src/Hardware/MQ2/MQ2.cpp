#include "MQ2.hpp"

MQ2Class::MQ2Class(uint8_t analogPin, uint8_t digitalPin){
    AnalogPin = analogPin;
    DigitalPin = digitalPin;
    Threshold = 300;
    pinMode(AnalogPin, INPUT);
    if (DigitalPin != 0xFF){
        pinMode(DigitalPin, INPUT);
    }
}

uint16_t MQ2Class::GetRawValue(){
    return analogRead(AnalogPin);
}

float MQ2Class::GetPercentage(){
    return (analogRead(AnalogPin) / 1023.0f) * 100.0f;
}

void MQ2Class::SetThreshold(uint16_t threshold){
    Threshold = threshold;
}

bool MQ2Class::GetState(){
    if (DigitalPin != 0xFF){
        return digitalRead(DigitalPin) == HIGH;
    }
    return GetRawValue() >= Threshold;
}