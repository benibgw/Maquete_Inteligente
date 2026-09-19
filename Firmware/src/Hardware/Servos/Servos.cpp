#include "Servos.hpp"

ServosClass::ServosClass(uint8_t pin){
    Pin = pin;
    Angle = 0;
    Motor.attach(Pin);
    Motor.write(Angle);
}

void ServosClass::SetAngle(uint8_t angle){
    angle = constrain(angle, 0, 180);
    if (Angle == angle){
        return;
    }
    Angle = angle;
    Motor.write(angle);
}

uint8_t ServosClass::GetAngle(){
    return Angle;
}

void ServosClass::Stop(){
    Motor.detach();
}