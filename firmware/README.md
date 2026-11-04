# Firmware

| Folder | Board | Purpose |
|---|---|---|
| `redqueen-case/` | ESP32-C3 Super Mini | Case controller for the final build: vial contacts, drawer, mist maker, lights. Wiring: [docs/hardware.md](../docs/hardware.md) |
| `esp32-ble-test/` | ESP32-WROOM-32 DevKit | Bluetooth test only: heartbeat, BOOT button as fake vial |

## Flashing

Uses the arduino-cli bundled with the Arduino IDE (or the IDE itself) and the `esp32:esp32` core **2.0.14**.

Library: **Adafruit NeoPixel**.

```sh
arduino-cli lib install "Adafruit NeoPixel"
arduino-cli compile -b esp32:esp32:esp32c3:CDCOnBoot=cdc firmware/redqueen-case
arduino-cli upload  -b esp32:esp32:esp32c3:CDCOnBoot=cdc -p COM15 firmware/redqueen-case
```

`CDCOnBoot=cdc` (in the IDE: Tools → USB CDC On Boot → Enabled) is needed for the serial monitor over the C3's USB-C port. If the upload doesn't start, hold BOOT, tap RESET, release BOOT and upload again.

## Settings

At the top of `redqueen-case.ino`:

| Setting | Default | Meaning |
|---|---|---|
| `USE_DRAWER_CLOSED_SWITCH` | `true` | "Drawer closed" limit switch wired |
| `USE_DRAWER_OPEN_SWITCH` | `true` | "Drawer open" limit switch wired; without it the drawer opens for `DRAWER_OPEN_MS` |
| `USE_LID_SWITCH` | `true` | Lid switch wired (closed = lid shut). Without it the lid counts as open |
| `VIAL_DEBOUNCE_MS` | 200 | The vial contacts must stay stable this long before a change counts |
| `MOTOR_SPEED` | 200 | Motor PWM duty, 0–255 |
| `DRAWER_OPEN_MS` / `DRAWER_CLOSE_MS` | 2500 | Run time without the matching limit switch |
| `DRAWER_TIMEOUT_MS` | 6000 | The motor always stops after this, even with switches |
| `MIST_DEFAULT_MS` | 10000 | Mist duration when the drawer opens |
| `LED_BRIGHTNESS` | 160 | NeoPixel brightness, 0–255 |

### Lights

All 28 LEDs are one chain on GPIO10: 0–14 inside the case, 15–22 logo, 23–27 drawer. The effects drive the inside and logo LEDs; the drawer LEDs ignore the effect and glow green while the drawer isn't closed (off with `LED:OFF`). Lengths are at the top of `lights.h`.

## Protocol

Text lines over the Nordic UART Service, device name `RedQueenCase`. The same commands work in the serial monitor, so everything can be tested without the app. Commands aren't case-sensitive.

### Case → app

| Line | Meaning |
|---|---|
| `HB:<counter>:<uptime s>` | Heartbeat every 2 s |
| `PONG` | Reply to `PING` |
| `VIAL:0` / `VIAL:1` | Vial removed / in place (on change, and in the status after connecting) |
| `DRAWER:<state>` | `UNKNOWN`, `CLOSED`, `OPENING`, `OPEN`, `CLOSING`, or `STUCK` (timeout before the limit switch triggered) |
| `MIST:ON` / `MIST:OFF` | Mist maker switched |
| `BTN:OVERRIDE` | Hidden override button pressed (it also opens or closes the drawer itself) |
| `LID:0` / `LID:1` | Lid closed / open |
| `LED:<effect>` | Current light effect: in the status and on every change, also the automatic ones |
| `BRIGHTNESS:<n>` | LED brightness 0–255 (in the status and after `LED:BRIGHTNESS`) |
| `SW:CLOSED:<0/1>` / `SW:OPEN:<0/1>` | Drawer end switches "closed" / "open" pressed (in the status and on change; reported even if not used) |
| `FW:<version>` | Firmware version (in the status) |
| `ERR:UNKNOWN:<line>` | Unknown command |

After connecting (and on `STATUS`), the case sends its status: firmware version, vial, drawer, lid, light effect, brightness, mist, end switches.

### App → case

| Line | Effect |
|---|---|
| `PING` | Answered with `PONG` |
| `STATUS` | Sends the status again |
| `LED:<effect>` | `OFF`, `IDLE`, `ALERT`, `ESCALATE`, `GAME`, `WIN`, `FAIL`, `COUNTDOWN`. From then on the app controls the lights. `IDLE` follows the lid: all white while open, off while closed |
| `LED:BRIGHTNESS:<n>` / `LED:BRIGHTNESS` | Brightness 0–255, or back to the default (`LED_BRIGHTNESS`) |
| `LED:COLOR:<zone>:<RRGGBB>` | `CUSTOM` effect: a fixed colour for `INSIDE`, `LOGO`, `DRAWER` or `ALL` (hex colour). The drawer LEDs follow it too |
| `LED:COUNTDOWN:<s>` | Countdown over `<s>` seconds instead of the default 10: the inside LEDs turn red pair by pair from both ends towards the middle, the logo ticks red once a second. It stays all red when the time is up |
| `LED:AUTO` | Back to automatic lights (also after a disconnect) |
| `DRAWER:OPEN` / `DRAWER:CLOSE` | Moves the drawer; opening also starts the mist |
| `DRAWER:OPEN:DRY` | Opens the drawer without the mist (hardware test) |
| `DRAWER:STOP` | Stops the motor wherever the drawer is (hardware test) |
| `MIST:ON` / `MIST:OFF` / `MIST:<s>` | Mist for the default time, off, or for `<s>` seconds (at most 30) |
| `SIM:VIAL:0` / `SIM:VIAL:1` | Fakes the vial (testing without the contacts) |
| `SIM:OFF` | Back to the contacts |

### Without the app

The case also works on its own:
- Lights: all white while the lid is open and off while it's closed (`IDLE`). When the vial is removed, a 10 s countdown runs (`COUNTDOWN`, `COUNTDOWN_MS`), but the seal breaks "unexpectedly" after 7 s (`SEAL_FAILS_AFTER_MS`) and the lights blink red/white (`ALERT`). Putting the vial back always returns to `IDLE`, also after the seal broke. With the app connected, the app runs the game and sends the effects itself.
- The override button opens the drawer, or closes it if it's already open.
- The onboard LED blinks while the case waits for the app, and stays on when connected.
