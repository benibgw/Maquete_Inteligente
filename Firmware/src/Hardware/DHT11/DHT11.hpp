#pragma once
#include <Arduino.h>
#include <DHT.h>

class DHT11Class{
    public:
        DHT11Class(uint8_t pin);
        void Begin();
        void Refresh();
        float GetTemperature();
        float GetHumidity();
        bool GetState();
    private:
        DHT Sensor;
        float Temperature;
        float Humidity;
};