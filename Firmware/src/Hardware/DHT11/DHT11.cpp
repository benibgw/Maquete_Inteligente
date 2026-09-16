#include "DHT11.hpp"
#include <math.h>

DHT11Class::DHT11Class(uint8_t pin) : Sensor(pin, DHT11){
    Temperature = NAN;
    Humidity = NAN;
}

void DHT11Class::Begin(){
    Sensor.begin();
}

void DHT11Class::Refresh(){
    float temperature = Sensor.readTemperature();
    float humidity = Sensor.readHumidity();
    if (isnan(temperature) || isnan(humidity)){
        Temperature = NAN;
        Humidity = NAN;
    }
    else{
        Temperature = temperature;
        Humidity = humidity;
    }
}

float DHT11Class::GetTemperature(){
    return Temperature;
}

float DHT11Class::GetHumidity(){
    return Humidity;
}

bool DHT11Class::GetState(){
    return !(isnan(Temperature) || isnan(Humidity));
}