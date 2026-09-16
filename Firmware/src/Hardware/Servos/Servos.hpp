#pragma once
#include <Arduino.h>
#include <Servo.h>

class ServosClass{
    public:
        ServosClass(uint8_t pin);
        void SetAngle(uint8_t angle);
        uint8_t GetAngle();
        void Stop();
    private:
        uint8_t Pin;
        uint8_t Angle;
        Servo Motor;
};