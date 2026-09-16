#include "Nema17.hpp"

Nema17Class::Nema17Class(uint16_t stepsPerRevolution, uint8_t pin1, uint8_t pin2, uint8_t pin3, uint8_t pin4)
    : Motor(stepsPerRevolution, pin1, pin2, pin3, pin4){
    StepsPerRevolution = stepsPerRevolution;
    Position = 0;
    Motor.setSpeed(60);
}

void Nema17Class::SetSpeed(uint8_t rpm){
    Motor.setSpeed(rpm);
}

void Nema17Class::Step(int16_t steps){
    Motor.step(steps);
    Position += steps;
}

void Nema17Class::Rotate(int16_t degrees){
    int32_t steps = ((int32_t)degrees * StepsPerRevolution) / 360;
    Motor.step(steps);
    Position += steps;
}

int32_t Nema17Class::GetPosition(){
    return Position;
}