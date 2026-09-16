#include "Display.hpp"

DisplayClass::DisplayClass(uint8_t width, uint8_t height, uint8_t i2cAddress, int8_t resetPin)
    : Screen(width, height, &Wire, resetPin){
    I2CAddress = i2cAddress;
    State = false;
}

bool DisplayClass::Begin(){
    State = Screen.begin(SSD1306_SWITCHCAPVCC, I2CAddress);
    Screen.clearDisplay();
    Screen.display();
    return State;
}

void DisplayClass::Clear(){
    Screen.clearDisplay();
}

void DisplayClass::Show(){
    Screen.display();
}

void DisplayClass::ClearShow(){
    Screen.clearDisplay();
    Screen.display();
}

void DisplayClass::SetTextSize(uint8_t size){
    Screen.setTextSize(size);
}

void DisplayClass::SetTextColor(uint16_t color){
    Screen.setTextColor(color);
}

void DisplayClass::SetCursor(uint8_t x, uint8_t y){
    Screen.setCursor(x, y);
}

void DisplayClass::SetTextWrap(bool wrap){
    Screen.setTextWrap(wrap);
}

void DisplayClass::PrintText(const char* text){
    Screen.print(text);
}

void DisplayClass::PrintInt(int32_t number){
    Screen.print(number);
}

void DisplayClass::PrintFloat(float number, uint8_t decimals){
    Screen.print(number, decimals);
}

void DisplayClass::Invert(bool inverted){
    Screen.invertDisplay(inverted);
}

void DisplayClass::SetContrast(uint8_t contrast){
    Screen.ssd1306_command(SSD1306_SETCONTRAST);
    Screen.ssd1306_command(contrast);
}

void DisplayClass::SetRotation(uint8_t rotation){
    Screen.setRotation(rotation);
}

bool DisplayClass::GetState(){
    return State;
}

Adafruit_SSD1306& DisplayClass::GetDisplay(){
    return Screen;
}