#include "MQ2.hpp"

namespace{
    const float FilterAlpha = 0.3f;
}

MQ2Class::MQ2Class(uint8_t analogPin, uint8_t digitalPin){
    AnalogPin = analogPin;
    DigitalPin = digitalPin;
    Threshold = 300;
    FilteredRaw = 0.0f;
    LastFilteredAt = 0;
    pinMode(AnalogPin, INPUT);
    if (DigitalPin != 0xFF){
        pinMode(DigitalPin, INPUT);
    }
}

void MQ2Class::SampleAndFilter(){
    float raw = (float)analogRead(AnalogPin);
    if (LastFilteredAt == 0){
        FilteredRaw = raw;
        LastFilteredAt = millis();
        return;
    }
    FilteredRaw = raw * FilterAlpha + FilteredRaw * (1.0f - FilterAlpha);
}

uint16_t MQ2Class::GetRawValue(){
    SampleAndFilter();
    return (uint16_t)FilteredRaw;
}

float MQ2Class::GetPercentage(){
    SampleAndFilter();
    return (FilteredRaw / 1023.0f) * 100.0f;
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