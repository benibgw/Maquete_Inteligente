#pragma once
#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_SSD1306.h>

class DisplayClass{
    public:
        DisplayClass(uint8_t width = 128, uint8_t height = 64, uint8_t i2cAddress = 0x3C, int8_t resetPin = -1);
        bool Begin();
        void Clear();
        void Show();
        void ClearShow();
        void SetTextSize(uint8_t size);
        void SetTextColor(uint16_t color);
        void SetCursor(uint8_t x, uint8_t y);
        void SetTextWrap(bool wrap);
        void PrintText(const char* text);
        void PrintInt(int32_t number);
        void PrintFloat(float number, uint8_t decimals);
        void Invert(bool inverted);
        void SetContrast(uint8_t contrast);
        void SetRotation(uint8_t rotation);
        bool GetState();
        Adafruit_SSD1306& GetDisplay();
    private:
        Adafruit_SSD1306 Screen;
        uint8_t I2CAddress;
        bool State;
};