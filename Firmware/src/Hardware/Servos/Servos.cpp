#include "Servos.hpp"

ServosClass::ServosClass(uint8_t pin){
    Pin = pin;
    Angle = 0;
    Motor.attach(Pin);
}

void ServosClass::SetAngle(uint8_t angle){
    Angle = constrain(angle, 0, 180);
    Motor.write(Angle);
}

uint8_t ServosClass::GetAngle(){
    return Motor.read();
}

void ServosClass::Stop(){
    Motor.detach();
}