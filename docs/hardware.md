# Hardware connections (2026 build)

Planned wiring for the case controller. Nothing here has been built or tested yet. The 2024 wiring is in [oldcase.md](../oldcase.md).

The old Android phone is screen, speaker and mic, and talks to the controller over Bluetooth LE (see [roadmap](roadmap.md), phase 3). The controller reads the sensors and drives the lights, the drawer and the mist maker.

## Parts

| Part | Job |
|---|---|
| ESP32-C3 Super Mini | Case controller, BLE link to the phone |
| VL53L1X time-of-flight sensor | Detects whether the vial is in its holder |
| 23 × WS2812 (NeoPixel) | 8 in the emblem (LEDs 0–7), 15 in the side strips (LEDs 8–22), reused from 2024 |
| 74AHCT125 (or similar) | Level shifter for the NeoPixel data line (3.3 V → 5 V) |
| DRV8833 motor driver | Drives the drawer motor |
| Small DC gear motor with rubber-band drive | Opens and closes the antidote drawer; the band slips at both ends |
| Micro switch | End switch "drawer closed" |
| Micro switch (optional) | End switch "drawer open"; not needed with the slip drive and a timed open |
| Logic-level N-MOSFET (AO3400, IRLZ34N, …) | Switches the ultrasonic mist maker |
| Ultrasonic mist maker (5 V, with driver board) | Mist when the drawer opens |
| Push button, hidden | Override: opens the drawer without the phone |
| Reed or micro switch | Lid switch: the LEDs turn on white when the lid opens |
| USB-C power bank, 3 A / 10000 mAh, PD 45 W | Powers phone, controller and loads |

There's no language switch. The language is chosen on the phone with a hidden gesture on the standby screen.

## Pin map (ESP32-C3 Super Mini)

The board has 16 header pins: 3 for power (5V, GND, 3V3) and 13 GPIOs. Top view (components up, USB-C port at the top):

```
             USB-C
 GPIO5       o   o  5V
 GPIO6       o   o  GND
 GPIO7       o   o  3V3
 GPIO8       o   o  GPIO4
 GPIO9       o   o  GPIO3
 GPIO10      o   o  GPIO2
 GPIO20 (RX) o   o  GPIO1
 GPIO21 (TX) o   o  GPIO0
```

| GPIO | Connection | Mode | Note |
|---|---|---|---|
| 0 | End switch "drawer closed" → GND | `INPUT_PULLUP`, LOW = closed | |
| 1 | End switch "drawer open" → GND (optional) | `INPUT_PULLUP`, LOW = open | |
| 2 | – | | Spare. Strapping pin, must not be LOW at boot, so only for an output or a normally open button |
| 3 | MOSFET gate (mist maker) | Output, HIGH = mist on | 10 kΩ pull-down to GND keeps the mist off during boot |
| 4 | DRV8833 AIN1 | PWM output | |
| 5 | DRV8833 AIN2 | PWM output | |
| 6 | VL53L1X SDA | I²C | |
| 7 | VL53L1X SCL | I²C | |
| 8 | Onboard LED | Output, LOW = on | Strapping pin; status LED (blinks while advertising, on when connected) |
| 9 | Override button → GND, parallel to the onboard BOOT button | `INPUT_PULLUP`, LOW = pressed | Strapping pin; holding it at power-up only enters flash mode |
| 10 | NeoPixel data (through the level shifter) | Output | |
| 20 | Lid switch → GND, closed while the lid is shut | `INPUT_PULLUP`, LOW = shut | |
| 21 | – | | Spare. Sends the boot log at power-up, so only use it for something that doesn't mind |
| 18, 19 | USB | | Not on the header, only wired to the USB-C port |

This uses 10 pins including the onboard LED and the lid switch, 11 with the optional "drawer open" switch, and leaves GPIO2 and GPIO21 spare.

## Connections per part

### VL53L1X (vial sensor)

| VL53L1X | Connects to |
|---|---|
| VIN | 3.3 V |
| GND | GND |
| SDA | GPIO6 |
| SCL | GPIO7 |
| XSHUT, GPIO1 | Not connected |

- Most breakout boards already have I²C pull-ups. I²C address 0x29.
- The sensor only measures reliably from about **4 cm**. Mount it at least 5 cm from the vial and look for a change in distance (vial there vs. gone), not an exact value.
- Clear glass gives poor readings. Point it at a non-transparent part of the vial (cap or base), or put a small opaque marker there.

### NeoPixels

```
5 V ──────────────────────────┬──────────── LED strip 5 V
                           1000 µF
GND ──────────────────────────┴──────────── LED strip GND
GPIO10 ── 74AHCT125 (5 V) ── 330 Ω ──────── LED strip DIN
```

- Supply the strip from the power bank's 5 V, not from the board.
- The 74AHCT125 runs on 5 V; tie its OE pin to GND. 3.3 V data often works without it, but not reliably.
- Full white on all 23 LEDs draws about 1.4 A. The red effects need much less.

### DRV8833 (drawer motor)

| DRV8833 | Connects to |
|---|---|
| VM (VCC) | 5 V |
| GND | GND |
| AIN1 | GPIO4 |
| AIN2 | GPIO5 |
| AOUT1, AOUT2 | Drawer motor |
| nSLEEP (EEP / STBY) | 3.3 V (it has an internal pull-down, so the driver sleeps if left open) |
| nFAULT | Not connected |
| BIN1, BIN2, BOUT1, BOUT2 | Not connected (second channel unused) |

| AIN1 | AIN2 | Motor |
|---|---|---|
| PWM | LOW | Open |
| LOW | PWM | Close |
| HIGH | HIGH | Brake |
| LOW | LOW | Off (coast) |

- With the rubber-band drive the band slips at the ends, so the firmware runs the motor for a fixed time (open) or until the "drawer closed" switch triggers, with a timeout as backup.
- With both limit switches the motor runs until the matching switch triggers, again with a timeout, so a stuck or broken switch can't keep the motor running.
- Some breakout boards label nSLEEP as EEP or STBY, and some already pull it high.

### Mist maker (MOSFET, low side)

```
5 V ───────────────── mist maker +
                      mist maker − ── MOSFET drain
GPIO3 ── 100 Ω ── MOSFET gate
                  └── 10 kΩ ── GND
GND ───────────────── MOSFET source
```

- Use a logic-level MOSFET that fully switches at 3.3 V. The common IRF520 modules don't, and get hot.
- Mist maker driver boards draw about 0.3–0.5 A. A 100–470 µF capacitor at the board helps against dips.
- The water container must be well away from the electronics.

### Buttons and switches

All switches go from the GPIO to GND, using the internal pull-up. No extra resistors are needed.

| Switch | GPIO |
|---|---|
| Drawer closed | 0 |
| Drawer open (optional) | 1 |
| Override button | 9 |
| Lid | 20 |

## Power

```
Power bank (USB-C, 5 V / 3 A)
 ├── USB cable ──────── old Android phone
 └── 5 V distribution ─┬── ESP32-C3 5 V pin
                       ├── NeoPixels
                       ├── DRV8833 VM
                       └── mist maker
All GNDs connected together.
```

- Feed the loads directly from the 5 V line, not through the C3's USB port or its 3.3 V regulator. Only the VL53L1X, the DRV8833 nSLEEP pin and the switches use the board's 3.3 V.
- Don't power the C3 through its 5 V pin and USB at the same time while flashing, unless the board has a diode there. The safe way is to unplug the 5 V line while flashing.
- Rough peak current: mist maker 0.5 A, motor 0.5 A, LEDs up to 1.4 A, C3 0.1 A, plus the phone charging. That's within 3 A, as long as the LEDs don't run full white while the drawer moves.
