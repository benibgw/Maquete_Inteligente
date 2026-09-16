#pragma once
#include <Arduino.h>
#include <Stepper.h>

class Nema17Class{
    public:
        Nema17Class(uint16_t stepsPerRevolution, uint8_t pin1, uint8_t pin2, uint8_t pin3, uint8_t pin4);
        void SetSpeed(uint8_t rpm);
        void Step(int16_t steps);
        void Rotate(int16_t degrees);
        int32_t GetPosition();
    private:
        Stepper Motor;
        uint16_t StepsPerRevolution;
        int32_t Position;
};