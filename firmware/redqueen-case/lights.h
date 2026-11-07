#ifndef LIGHTS_H
#define LIGHTS_H

// Case lights, ported from the 2024 Halloween_Case/lights.h.
// One chain on one data pin, in this order:
//   LEDs  0-14  inside the case (the former side strips)
//   LEDs 15-22  logo / emblem
//   LEDs 23-27  inside the drawer

#include <Adafruit_NeoPixel.h>

#define INSIDE_FIRST  0
#define INSIDE_LENGTH 15
#define LOGO_FIRST    (INSIDE_FIRST + INSIDE_LENGTH)
#define LOGO_LENGTH   8
#define DRAWER_FIRST  (LOGO_FIRST + LOGO_LENGTH)
#define DRAWER_LENGTH 5
#define LED_COUNT     (DRAWER_FIRST + DRAWER_LENGTH)

// Standby: the white light fades in over this long when the lid is opened.
#define LID_FADE_IN_MS 1500
// Standby with the lid closed: the logo on the outside stays lit at this level (0-1).
#define LOGO_CLOSED_LEVEL 1.0

enum LightEffect
{
    LIGHTS_OFF,       // everything off, the drawer too
    LIGHTS_IDLE,      // standby: all white while the lid is open, off while it's closed
    LIGHTS_ALERT,     // vial removed: red/white flashing (2024 FLASH)
    LIGHTS_ESCALATE,  // seal failure: the same, much faster
    LIGHTS_GAME,      // Red Queen talking: red logo, inside slowly pulsing red
    LIGHTS_WIN,       // antidote released: pulsing green
    LIGHTS_FAIL,      // time is up: everything deep red
    LIGHTS_COUNTDOWN, // vial removed: the inside fills red from both ends, logo ticks red
    LIGHTS_CUSTOM,    // hardware test: a fixed colour per zone (LED:COLOR), drawer included
};

const char *const LIGHT_EFFECT_NAMES[] = {"OFF", "IDLE", "ALERT", "ESCALATE", "GAME", "WIN", "FAIL", "COUNTDOWN", "CUSTOM"};

enum LightZone
{
    ZONE_INSIDE,
    ZONE_LOGO,
    ZONE_DRAWER,
    ZONE_ALL,
};

const char *const LIGHT_ZONE_NAMES[] = {"INSIDE", "LOGO", "DRAWER", "ALL"};
const int LIGHT_EFFECT_COUNT = sizeof(LIGHT_EFFECT_NAMES) / sizeof(LIGHT_EFFECT_NAMES[0]);

class Lights
{
  public:
    Lights(int pin, uint8_t brightness) : strip(LED_COUNT, pin, NEO_GRB + NEO_KHZ800), level(brightness) {}

    void begin()
    {
        strip.begin();
        strip.setBrightness(level);
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
        unsigned long t = millis();
        render(t - effectStart);
        renderDrawer(t - drawerOpenedAt);
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

    // Starts (or restarts) the countdown: the inside LEDs turn red pair by pair, from both
    // ends towards the middle, all red once `durationMs` has passed since `startedAt`.
    void startCountdown(unsigned long durationMs, unsigned long startedAt)
    {
        Serial.print("Lights: COUNTDOWN ");
        Serial.println(durationMs);
        effect = LIGHTS_COUNTDOWN;
        countdownMs = max(durationMs, 1UL);
        effectStart = startedAt;
    }

    LightEffect current() { return effect; }

    uint8_t brightness() { return level; }

    void setBrightness(uint8_t value)
    {
        level = value;
        strip.setBrightness(value);
    }

    // Switches to CUSTOM and sets one zone (or all) to a fixed colour.
    void setCustomColor(LightZone zone, uint32_t color)
    {
        for (int z = ZONE_INSIDE; z <= ZONE_DRAWER; z++)
        {
            if (zone == ZONE_ALL || zone == z)
            {
                customColors[z] = color;
            }
        }
        setEffect(LIGHTS_CUSTOM);
    }

    static bool parseZone(const String &name, LightZone &result)
    {
        for (int i = 0; i <= ZONE_ALL; i++)
        {
            if (name == LIGHT_ZONE_NAMES[i])
            {
                result = (LightZone)i;
                return true;
            }
        }
        return false;
    }

    void setLidOpen(bool open)
    {
        if (open && !lidOpen)
        {
            lidOpenedAt = millis();
        }
        lidOpen = open;
    }

    // The drawer LEDs don't follow the effect: they light up while the drawer is open.
    void setDrawerOpen(bool open)
    {
        if (open && !drawerOpen)
        {
            drawerOpenedAt = millis();
        }
        drawerOpen = open;
    }

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
    uint8_t level;
    uint32_t customColors[3] = {0, 0, 0};  // inside, logo, drawer
    LightEffect effect = LIGHTS_OFF;
    bool lidOpen = true;
    unsigned long lidOpenedAt = 0;  // 0 at boot: already open, no fade
    bool drawerOpen = false;
    unsigned long effectStart = 0;
    unsigned long countdownMs = 7000;
    unsigned long drawerOpenedAt = 0;
    unsigned long lastUpdate = 0;

    // Inside and logo LEDs.
    void render(unsigned long t)
    {
        uint32_t white = strip.Color(255, 255, 255);
        uint32_t dimWhite = dimColor(white, 0.3);
        uint32_t red = strip.Color(255, 0, 0);

        switch (effect)
        {
        case LIGHTS_OFF:
            setCase(0);
            break;
        case LIGHTS_IDLE:
        {
            // Fades in after the lid opens; squared, so it looks even to the eye.
            float fade = lidOpenedAt == 0 ? 1.0 : min(1.0f, (millis() - lidOpenedAt) / (float)LID_FADE_IN_MS);
            if (lidOpen)
            {
                setCase(dimColor(white, fade * fade));
            }
            else
            {
                // Closed: the inside goes dark, the logo on the outside stays on.
                setInside(0);
                setLogo(dimColor(white, LOGO_CLOSED_LEVEL));
            }
            break;
        }
        case LIGHTS_ALERT:
        case LIGHTS_ESCALATE:
        {
            unsigned long half = effect == LIGHTS_ALERT ? 500 : 150;
            if ((t / half) % 2 == 0)
            {
                setLogo(red);
                setInsidePattern(dimWhite, red);
            }
            else
            {
                setLogo(white);
                setInside(dimWhite);
            }
            break;
        }
        case LIGHTS_GAME:
            setLogo(red);
            setInside(dimColor(red, pulse(t, 3000, 0.15)));
            break;
        case LIGHTS_WIN:
        {
            uint32_t green = strip.Color(0, 255, 80);
            setLogo(green);
            setInside(dimColor(green, pulse(t, 2000, 0.3)));
            break;
        }
        case LIGHTS_FAIL:
            setCase(strip.Color(120, 0, 0));
            break;
        case LIGHTS_COUNTDOWN:
            renderCountdown(t, white, red);
            break;
        case LIGHTS_CUSTOM:
            setInside(customColors[ZONE_INSIDE]);
            setLogo(customColors[ZONE_LOGO]);
            break;
        }
    }

    // Pairs from both ends: 0+14, 1+13, ... and the middle LED last. The first pair goes
    // red right away, the last one step before the time is up, so the full red shows a moment.
    void renderCountdown(unsigned long t, uint32_t white, uint32_t red)
    {
        const int steps = (INSIDE_LENGTH + 1) / 2;
        unsigned long stepMs = countdownMs / steps;
        int lit = min((int)(t / stepMs) + 1, steps);
        // The newest pair fades in over a quarter step, so it doesn't just pop on.
        float fade = lit == steps && t >= stepMs * steps ? 1.0 : min(1.0f, (float)(t % stepMs) / (stepMs / 4 + 1));
        uint32_t base = dimColor(white, 0.3);
        for (int i = 0; i < INSIDE_LENGTH; i++)
        {
            int fromEnd = min(i, INSIDE_LENGTH - 1 - i);  // 0 at both ends, highest in the middle
            uint32_t color = base;
            if (fromEnd < lit - 1)
            {
                color = red;
            }
            else if (fromEnd == lit - 1)
            {
                color = mix(base, red, fade);
            }
            strip.setPixelColor(INSIDE_FIRST + i, color);
        }
        // Logo: a red tick every second, like a clock.
        setLogo((t % 1000) < 150 ? red : dimColor(red, 0.15));
    }

    // Drawer LEDs: off unless the drawer is opening, open or closing (and off with LED:OFF). Then the antidote
    // glows white: a fade-in over the first second, then a slow breath.
    void renderDrawer(unsigned long t)
    {
        if (effect == LIGHTS_CUSTOM)
        {
            setRange(DRAWER_FIRST, DRAWER_LENGTH, customColors[ZONE_DRAWER]);
            return;
        }
        if (!drawerOpen || effect == LIGHTS_OFF)
        {
            setRange(DRAWER_FIRST, DRAWER_LENGTH, 0);
            return;
        }
        // pulse() is at full brightness at t = 1000, so the breathing joins the fade-in smoothly.
        float level = t < 1000 ? (float)t / 1000 : pulse(t, 2000, 0.5);
        setRange(DRAWER_FIRST, DRAWER_LENGTH, dimColor(strip.Color(255, 255, 255), level));
    }

    // Brightness between `low` and 1.0, one full breath every `period` ms.
    float pulse(unsigned long t, unsigned long period, float low)
    {
        float phase = (float)(t % period) / period;
        return low + (1.0 - low) * (0.5 - 0.5 * cos(phase * 2 * PI));
    }

    void setRange(int first, int length, uint32_t color)
    {
        for (int i = first; i < first + length; i++)
        {
            strip.setPixelColor(i, color);
        }
    }

    // Inside and logo, not the drawer.
    void setCase(uint32_t color)
    {
        setInside(color);
        setLogo(color);
    }

    void setLogo(uint32_t color) { setRange(LOGO_FIRST, LOGO_LENGTH, color); }

    void setInside(uint32_t color) { setRange(INSIDE_FIRST, INSIDE_LENGTH, color); }

    // Blocks of three: color2, color1, color2, ...
    void setInsidePattern(uint32_t color1, uint32_t color2)
    {
        for (int i = 0; i < INSIDE_LENGTH; i++)
        {
            strip.setPixelColor(INSIDE_FIRST + i, (i % 6) < 3 ? color2 : color1);
        }
    }

    uint32_t mix(uint32_t a, uint32_t b, float f)
    {
        uint8_t r = ((a >> 16) & 0xFF) * (1 - f) + ((b >> 16) & 0xFF) * f;
        uint8_t g = ((a >> 8) & 0xFF) * (1 - f) + ((b >> 8) & 0xFF) * f;
        uint8_t bl = (a & 0xFF) * (1 - f) + (b & 0xFF) * f;
        return strip.Color(r, g, bl);
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
