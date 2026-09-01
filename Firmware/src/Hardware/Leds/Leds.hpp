#pragma once
#include <Arduino.h>

class LedsClass{
    public:
      LedsClass(uint8_t pin);
      void TurnON();
      void TurnOFF();
      bool GetState();
    private:
      uint8_t Pin;
      bool State;
};