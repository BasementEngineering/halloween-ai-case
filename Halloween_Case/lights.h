#ifndef LIGHTS_H
#define LIGHTS_H

#include <Adafruit_NeoPixel.h>
#define LED_COUNT 23

#define EMBLEM_LENGTH 8
#define SIDE_STRIP_LENGTH 15

enum emblemEffects
{
    NONE,
    FLASH,
    RED,
    DEEP_RED,
    CHECK
};

class Lights
{
  public:
    Lights(int LED_PIN) : strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800)
    {
        currentState = NONE;
    }

    void begin()
    {
        strip.begin();
        strip.show();
        currentState = NONE;
        strip.setBrightness(255);
        setAll(strip.Color(50, 50, 50));
    }

    void update()
    {
        if (millis() - lastUpdate > 100)
        {
            lastUpdate = millis();
            runStateMachine();
            strip.show();
        }
    }

    void setState(int state)
    {
      Serial.print("New LED State: ");
      Serial.println(state);
        currentState = state;
        emblemCounter = 0;
    }

    void runStateMachine()
    {
        switch (currentState)
        {
        case NONE:
            setAll(strip.Color(0, 0, 0));
            setEmblem(strip.Color(255, 255, 255));
            break;
        case RED:
            setSideStrips(dimColor(strip.Color(255, 255, 255), 0.3));
            setEmblem(strip.Color(255, 0, 0));
            break;
        case FLASH:
            if (emblemCounter == 5)
            {
                setEmblem(strip.Color(255, 0, 0));
                setSideStripsPattern(dimColor(strip.Color(255, 255, 255), 0.3),strip.Color(255, 0, 0));
            }
            else if(emblemCounter == 10)
            {
                setSideStrips(dimColor(strip.Color(255, 255, 255), 0.3));
                setEmblem(strip.Color(255, 255, 255));
                emblemCounter = 0;
            }
            break;
        default:
            currentState = NONE;
            break;
        }
        emblemCounter++;
    }

    void setAll(uint32_t color)
    {
        for (int i = 0; i < strip.numPixels(); i++)
        {
            strip.setPixelColor(i, color);
        }
    }

    void setEmblem(uint32_t color)
    {
        for (int i = 0; i < EMBLEM_LENGTH; i++)
        {
            strip.setPixelColor(i, color);
        }
    }

    void setSideStrips(uint32_t color)
    {
        for (int i = EMBLEM_LENGTH; i < EMBLEM_LENGTH + SIDE_STRIP_LENGTH; i++)
        {
            strip.setPixelColor(i, color);
        }
    }

    void setSideStripsPattern(uint32_t color1, uint32_t color2){
        for(int i = EMBLEM_LENGTH; i < EMBLEM_LENGTH + SIDE_STRIP_LENGTH; i++){
            if(((i -EMBLEM_LENGTH) % 6) < 3){
                strip.setPixelColor(i, color2);
            } else {
                strip.setPixelColor(i, color1);
            }
        }
    }

    

    uint32_t dimColor(uint32_t color, float brightness)
    {
        int r = (color >> 16) & 0xFF;
        int g = (color >> 8) & 0xFF;
        int b = color & 0xFF;

        r = r * brightness;
        g = g * brightness;
        b = b * brightness;

        if (r < 0)
            r = 0;
        if (g < 0)
            g = 0;
        if (b < 0)
            b = 0;

        return strip.Color(r, g, b);
    }

private:
    Adafruit_NeoPixel strip;
    unsigned long lastUpdate = 0;
    int currentState = 0;
    int emblemCounter = 0;
};

#endif

  