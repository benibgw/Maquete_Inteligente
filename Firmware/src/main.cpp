#include <Arduino.h>
#include "Maquete/Maquete.hpp"

MaqueteClass Maquete;

void setup() {
  Maquete.Begin();
}

void loop() {
  Maquete.Update();
}