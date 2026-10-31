# Firmware

| Folder | Board | Purpose |
|---|---|---|
| `redqueen-case/` | ESP32-C3 Super Mini | Case controller for the final build: vial sensor, drawer, mist maker, lights. Wiring: [docs/hardware.md](../docs/hardware.md) |
| `esp32-ble-test/` | ESP32-WROOM-32 DevKit | Bluetooth test only: heartbeat, BOOT button as fake vial |

## Flashing

Uses the arduino-cli bundled with the Arduino IDE (or the IDE itself) and the `esp32:esp32` core **2.0.14**.

Libraries: **Adafruit NeoPixel** and **VL53L1X** (by Pololu).

```sh
arduino-cli lib install "Adafruit NeoPixel" "VL53L1X"
arduino-cli compile -b esp32:esp32:esp32c3:CDCOnBoot=cdc firmware/redqueen-case
arduino-cli upload  -b esp32:esp32:esp32c3:CDCOnBoot=cdc -p COM15 firmware/redqueen-case
```

`CDCOnBoot=cdc` (in the IDE: Tools → USB CDC On Boot → Enabled) is needed for the serial monitor over the C3's USB-C port. If the upload doesn't start, hold BOOT, tap RESET, release BOOT and upload again.

## Settings

At the top of `redqueen-case.ino`:

| Setting | Default | Meaning |
|---|---|---|
| `USE_DRAWER_CLOSED_SWITCH` | `true` | "Drawer closed" limit switch wired |
| `USE_DRAWER_OPEN_SWITCH` | `false` | "Drawer open" limit switch wired; without it the drawer opens for `DRAWER_OPEN_MS` |
| `USE_LID_SWITCH` | `true` | Lid switch wired (closed = lid shut). Without it the lid counts as open |
| `VIAL_IN_MM` / `VIAL_OUT_MM` | 80 / 110 | Distance below which the vial counts as in place, and above which as removed |
| `MOTOR_SPEED` | 200 | Motor PWM duty, 0–255 |
| `DRAWER_OPEN_MS` / `DRAWER_CLOSE_MS` | 2500 | Run time without the matching limit switch |
| `DRAWER_TIMEOUT_MS` | 6000 | The motor always stops after this, even with switches |
| `MIST_DEFAULT_MS` | 10000 | Mist duration when the drawer opens |
| `LED_BRIGHTNESS` | 160 | NeoPixel brightness, 0–255 |

### Calibrating the vial sensor

1. Open the serial monitor at 115200 baud and send `TOF:LOG`. The distance is now printed every 2 s.
2. Note the value with the vial in place and with it removed.
3. Set `VIAL_IN_MM` a bit above the "in place" value and `VIAL_OUT_MM` a bit below the "removed" value. "FAR" means no target in range, which counts as removed.

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
| `LED:<effect>` | Current light effect (in the status) |
| `TOF:<mm>` | Reply to `TOF?`: distance, `FAR`, `NONE` (no sensor) or `SIM` |
| `ERR:TOF` | Vial sensor not found or lost; it retries every 5 s |
| `ERR:UNKNOWN:<line>` | Unknown command |

After connecting, the case sends its status: vial (or `ERR:TOF`), drawer, lid, light effect.

### App → case

| Line | Effect |
|---|---|
| `PING` | Answered with `PONG` |
| `STATUS` | Sends the status again |
| `LED:<effect>` | `OFF`, `IDLE`, `ALERT`, `ESCALATE`, `GAME`, `WIN`, `FAIL`. From then on the app controls the lights. `IDLE` follows the lid: all white while open, off while closed |
| `LED:AUTO` | Back to automatic lights (also after a disconnect) |
| `DRAWER:OPEN` / `DRAWER:CLOSE` | Moves the drawer; opening also starts the mist |
| `MIST:ON` / `MIST:OFF` / `MIST:<s>` | Mist for the default time, off, or for `<s>` seconds (at most 30) |
| `TOF?` | Current distance |
| `TOF:LOG` | Toggles distance logging to the serial monitor |
| `SIM:VIAL:0` / `SIM:VIAL:1` | Fakes the vial (testing without the sensor) |
| `SIM:OFF` | Back to the sensor |

### Without the app

The case also works on its own:
- Lights: all white while the lid is open and off while it's closed (`IDLE`). 7 s after the vial is removed the seal breaks and the lights blink red/white (`ALERT`). Putting the vial back doesn't stop that; only opening the drawer (the antidote) turns them white again.
- The override button opens the drawer, or closes it if it's already open.
- The onboard LED blinks while the case waits for the app, and stays on when connected.
