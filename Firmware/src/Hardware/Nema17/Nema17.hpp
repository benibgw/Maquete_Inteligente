#pragma once
#include <Arduino.h>

class Nema17Class{
    public:
        Nema17Class(uint16_t stepsPerRevolution, uint8_t pin1, uint8_t pin2, uint8_t pin3, uint8_t pin4);
        void SetSpeed(uint8_t rpm);
        void MoveTo(int32_t target);
        void Update();
        int32_t GetPosition();
        bool IsMoving();
    private:
        void WriteSequence(uint8_t index);

        uint8_t Pin1;
        uint8_t Pin2;
        uint8_t Pin3;
        uint8_t Pin4;
        uint16_t StepsPerRevolution;
        uint16_t StepIntervalMicros;
        int32_t Position;
        int32_t Target;
        bool Moving;
        uint8_t StepIndex;
        unsigned long LastStepMicros;
};