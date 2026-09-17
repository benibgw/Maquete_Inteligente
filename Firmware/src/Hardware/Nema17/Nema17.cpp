#include "Nema17.hpp"

Nema17Class::Nema17Class(uint16_t stepsPerRevolution, uint8_t pin1, uint8_t pin2, uint8_t pin3, uint8_t pin4){
    Pin1 = pin1;
    Pin2 = pin2;
    Pin3 = pin3;
    Pin4 = pin4;
    StepsPerRevolution = stepsPerRevolution;
    Position = 0;
    Target = 0;
    Moving = false;
    StepIndex = 0;
    LastStepMicros = 0;
    StepIntervalMicros = 0;
    pinMode(Pin1, OUTPUT);
    pinMode(Pin2, OUTPUT);
    pinMode(Pin3, OUTPUT);
    pinMode(Pin4, OUTPUT);
    SetSpeed(60);
}

void Nema17Class::SetSpeed(uint8_t rpm){
    uint16_t stepsPerSec = ((uint32_t)StepsPerRevolution * rpm) / 60;
    StepIntervalMicros = (rpm == 0 || stepsPerSec == 0) ? 0 : (1000000UL / stepsPerSec);
}

void Nema17Class::MoveTo(int32_t target){
    Target = target;
    Moving = (Position != Target);
    LastStepMicros = micros();
}

void Nema17Class::Update(){
    if (!Moving || StepIntervalMicros == 0){
        return;
    }
    unsigned long now = micros();
    if (now - LastStepMicros < StepIntervalMicros){
        return;
    }
    LastStepMicros = now;
    int32_t direction = (Target > Position) ? 1 : -1;
    StepIndex = (uint8_t)((StepIndex + direction + 4) % 4);
    WriteSequence(StepIndex);
    Position += direction;
    if (Position == Target){
        Moving = false;
    }
}

void Nema17Class::WriteSequence(uint8_t index){
    switch (index){
        case 0:
            digitalWrite(Pin1, HIGH);
            digitalWrite(Pin2, LOW);
            digitalWrite(Pin3, HIGH);
            digitalWrite(Pin4, LOW);
            break;
        case 1:
            digitalWrite(Pin1, LOW);
            digitalWrite(Pin2, HIGH);
            digitalWrite(Pin3, HIGH);
            digitalWrite(Pin4, LOW);
            break;
        case 2:
            digitalWrite(Pin1, LOW);
            digitalWrite(Pin2, HIGH);
            digitalWrite(Pin3, LOW);
            digitalWrite(Pin4, HIGH);
            break;
        case 3:
            digitalWrite(Pin1, HIGH);
            digitalWrite(Pin2, LOW);
            digitalWrite(Pin3, LOW);
            digitalWrite(Pin4, HIGH);
            break;
    }
}

int32_t Nema17Class::GetPosition(){
    return Position;
}

bool Nema17Class::IsMoving(){
    return Moving;
}