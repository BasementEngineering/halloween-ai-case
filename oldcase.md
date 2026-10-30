# The 2024 Case (GLaDOS edition)

This describes the system as it was built for Halloween 2024. The source is in `Halloween_Case/` and the voice lines are in `Content/GladosVoicelines/`.

## Overview

A Resident Evil-inspired prop case holding a fake T-virus vial. When someone opens the lid, the case "notices" the breach. A computer voice (GLaDOS-style) gets more and more threatening the longer the case stays open, and LEDs in the case emblem and along the sides react. Closing the lid resets everything. A power bank powers the whole case.

## Hardware

| Part | Details |
|---|---|
| Microcontroller | ESP8266 board with D1 mini-style pin labels (D1, D3, D5, ...) |
| Sound | DFRobot DFPlayer Mini (MP3 from SD card), connected over SoftwareSerial |
| LEDs | 23 × WS2812 (NeoPixel): 8 in the emblem, 15 in the side strips |
| Lid sensor | Switch on the lid, input with internal pull-up |
| Vial sensor | Wired and read, but not used by the logic |
| Keypad | One input, read but not used |
| Volume poti | On A0. The code for it exists but is disabled |
| Power | USB power bank |

### Pin map (from `Halloween_Case.ino`)

| Signal | GPIO | Board label | Note |
|---|---|---|---|
| Lid (`CASE_BREACHED_PIN`) | 5 | D1 | `INPUT_PULLUP`, HIGH = open |
| Vial (`VIRUS_VIAL1_PIN`) | 2 | D4 | The code comment says D2, but GPIO2 is D4 |
| Keypad (`KEYPAD_PIN`) | 0 | D3 | Boot strap pin |
| Volume poti (`POTI_PIN`) | A0 | A0 | Unused |
| DFPlayer RX (`PLAYER_RX`) | 14 | D5 | SoftwareSerial, 9600 baud |
| DFPlayer TX (`PLAYER_TX`) | 12 | D6 | |
| NeoPixel data (`LED_PIN`) | 2 | D4 | **Same pin as the vial input** |

## Software

- Written in the Arduino IDE.
- Libraries: `DFRobotDFPlayerMini`, `Adafruit_NeoPixel`, `SoftwareSerial`.
- `loop()` runs the case state machine and updates the lights. Once a second it prints the sensor states to serial (115200 baud).

### Voice lines

The DFPlayer plays tracks by number. The numbers map to the files in `Content/GladosVoicelines/`:

| # | Enum name | Used |
|---|---|---|
| 1 | `STARTING_LINE` | On boot |
| 2 | `CASE_BREACHED_LINE` | Lid opened |
| 3 | `WRONG_CODE_LINE` | Never used |
| 4 | `MOST_IMPORTANTLY_LINE` | Never used |
| 5 | `CASE_CLOSED_LINE` | Lid closed again |
| 6 | `ACTIVATING_TRACKING_LINE` | Open for 10 s |
| 7 | `EXPLODING_IN_LINE` | Open for 20 s |
| 8 | `YOU_GOT_ME_HELP_LINE` | Open for 41 s |
| 9 | `INSULTS_LINE` | Loop, alternating |
| 10 | `HELP_OTHER_LINE` | Loop, alternating |

The enum names are the only description of what each line says.

### State machine

```
IDLE ──lid open──▶ CASE_BREACHED ──10 s──▶ CASE_LEFT_OPEN_30S ──10 s──▶ LEFT_OPEN_LONGER ──21 s──▶ HOPELESS_OPEN_LOOP
  ▲                    │                        │                           │                          │ every 20 s:
  └────────────── lid closed (from any state): lights NONE, play CASE_CLOSED_LINE ◀──────────────────────┘ INSULTS / HELP_OTHER
```

| State | On entry | Lights |
|---|---|---|
| `IDLE` | – | `NONE` |
| `CASE_BREACHED` | `CASE_BREACHED_LINE` | `RED` |
| `CASE_LEFT_OPEN_30S` | `ACTIVATING_TRACKING_LINE` | `FLASH` |
| `LEFT_OPEN_LONGER` | `EXPLODING_IN_LINE` | `FLASH` |
| `HOPELESS_OPEN_LOOP` | `YOU_GOT_ME_HELP_LINE`, then alternating `INSULTS_LINE` / `HELP_OTHER_LINE` every 20 s | `RED` |

The state `CASE_LEFT_OPEN_30S` is actually reached after 10 s, not 30 s. The enum also has a `CASE_CLOSED` state that is never used.

### Light effects (`lights.h`)

The `Lights` class updates every 100 ms. LEDs 0–7 are the emblem and LEDs 8–22 are the side strips.

| Effect | Emblem | Side strips |
|---|---|---|
| `NONE` | White | Off |
| `RED` | Red | White at 30% |
| `FLASH` | Toggles every 0.5 s between red and white | Toggles between a red/white pattern (3 red, 3 white) and white at 30% |

`DEEP_RED` and `CHECK` exist in the enum but aren't implemented. They fall back to `NONE`.

## Known issues

- **GPIO2 conflict:** the vial input and the NeoPixel data line both use GPIO2. That's likely why the vial was never used in the logic.
- **Volume control doesn't work.** `setup()` sets the volume to 30. `checkVolumeInput()` would force it to 15 and return before reading the poti, but it's commented out of `loop()` anyway.
- **Boot hangs without the SD card.** `setupSoundPlayer()` loops forever if the DFPlayer doesn't answer.
- **Keypad pin on GPIO0.** GPIO0 is a boot strap pin, so holding it low at power-on puts the ESP8266 into flash mode.
- The vial and keypad inputs are only printed to serial and don't change anything.
