#ifndef LIGHTS_H
#define LIGHTS_H

// Case lights, ported from the 2024 Halloween_Case/lights.h.
// LEDs 0-7 are the emblem, LEDs 8-22 the side strips.

#include <Adafruit_NeoPixel.h>

#define LED_COUNT 23
#define EMBLEM_LENGTH 8
#define SIDE_STRIP_LENGTH 15

enum LightEffect
{
    LIGHTS_OFF,
    LIGHTS_IDLE,      // standby: all white while the lid is open, off while it's closed
    LIGHTS_ALERT,     // vial removed: red/white flashing (2024 FLASH)
    LIGHTS_ESCALATE,  // seal failure: the same, much faster
    LIGHTS_GAME,      // Red Queen talking: red emblem, sides slowly pulsing red
    LIGHTS_WIN,       // antidote released: pulsing green
    LIGHTS_FAIL,      // time is up: everything deep red
};

const char *const LIGHT_EFFECT_NAMES[] = {"OFF", "IDLE", "ALERT", "ESCALATE", "GAME", "WIN", "FAIL"};
const int LIGHT_EFFECT_COUNT = sizeof(LIGHT_EFFECT_NAMES) / sizeof(LIGHT_EFFECT_NAMES[0]);

class Lights
{
  public:
    Lights(int pin, uint8_t brightness) : strip(LED_COUNT, pin, NEO_GRB + NEO_KHZ800), brightness(brightness) {}

    void begin()
    {
        strip.begin();
        strip.setBrightness(brightness);
        strip.clear();
        strip.show();
    }

    void update()
    {
        if (millis() - lastUpdate < 50)
        {
            return;
        }
        lastUpdate = millis();
        render(millis() - effectStart);
        strip.show();
    }

    void setEffect(LightEffect next)
    {
        if (next == effect)
        {
            return;
        }
        Serial.print("Lights: ");
        Serial.println(LIGHT_EFFECT_NAMES[next]);
        effect = next;
        effectStart = millis();
    }

    LightEffect current() { return effect; }

    void setLidOpen(bool open) { lidOpen = open; }

    // Looks up an effect by name, e.g. "ALERT". Returns false for unknown names.
    static bool parse(const String &name, LightEffect &result)
    {
        for (int i = 0; i < LIGHT_EFFECT_COUNT; i++)
        {
            if (name == LIGHT_EFFECT_NAMES[i])
            {
                result = (LightEffect)i;
                return true;
            }
        }
        return false;
    }

  private:
    Adafruit_NeoPixel strip;
    uint8_t brightness;
    LightEffect effect = LIGHTS_OFF;
    bool lidOpen = true;
    unsigned long effectStart = 0;
    unsigned long lastUpdate = 0;

    void render(unsigned long t)
    {
        uint32_t white = strip.Color(255, 255, 255);
        uint32_t dimWhite = dimColor(white, 0.3);
        uint32_t red = strip.Color(255, 0, 0);

        switch (effect)
        {
        case LIGHTS_OFF:
            strip.clear();
            break;
        case LIGHTS_IDLE:
            if (lidOpen)
            {
                setAll(white);
            }
            else
            {
                strip.clear();
            }
            break;
        case LIGHTS_ALERT:
        case LIGHTS_ESCALATE:
        {
            unsigned long half = effect == LIGHTS_ALERT ? 500 : 150;
            if ((t / half) % 2 == 0)
            {
                setEmblem(red);
                setSideStripsPattern(dimWhite, red);
            }
            else
            {
                setEmblem(white);
                setSideStrips(dimWhite);
            }
            break;
        }
        case LIGHTS_GAME:
            setEmblem(red);
            setSideStrips(dimColor(red, pulse(t, 3000, 0.15)));
            break;
        case LIGHTS_WIN:
        {
            uint32_t green = strip.Color(0, 255, 80);
            setEmblem(green);
            setSideStrips(dimColor(green, pulse(t, 2000, 0.3)));
            break;
        }
        case LIGHTS_FAIL:
            setAll(strip.Color(120, 0, 0));
            break;
        }
    }

    // Brightness between `low` and 1.0, one full breath every `period` ms.
    float pulse(unsigned long t, unsigned long period, float low)
    {
        float phase = (float)(t % period) / period;
        return low + (1.0 - low) * (0.5 - 0.5 * cos(phase * 2 * PI));
    }

    void setAll(uint32_t color)
    {
        for (int i = 0; i < LED_COUNT; i++)
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

    void setSideStripsPattern(uint32_t color1, uint32_t color2)
    {
        for (int i = EMBLEM_LENGTH; i < EMBLEM_LENGTH + SIDE_STRIP_LENGTH; i++)
        {
            strip.setPixelColor(i, ((i - EMBLEM_LENGTH) % 6) < 3 ? color2 : color1);
        }
    }

    uint32_t dimColor(uint32_t color, float factor)
    {
        uint8_t r = ((color >> 16) & 0xFF) * factor;
        uint8_t g = ((color >> 8) & 0xFF) * factor;
        uint8_t b = (color & 0xFF) * factor;
        return strip.Color(r, g, b);
    }
};

#endif
