# Roadmap & To-dos

Goal: the Red Queen case, ready to publish by **2026-11-15**. The concept is in the [README](../README.md); the 2024 version is described in [oldcase.md](../oldcase.md).

## Status (2026-10-29)

**Phase 1 (on the laptop) is largely done:**

- [x] Persona, game rules and system prompt → [redqueen-persona.md](redqueen-persona.md)
- [x] 20 pre-recorded lines written → [redqueen-voicelines.md](redqueen-voicelines.md)
- [x] Voice: custom Mistral voice "Red Queen"
- [x] Mistral voice agent `red-queen`, created and updated from the repo with `npm run agent:sync` → [mistral-setup.md](mistral-setup.md)
- [x] Test console (`npm run dev`): talk to her, with trust meter, 3:00 timer, clearance code check, win and fail screens, transcript and tool log
- [x] Game rules enforced by the app, with unit tests (`npm test`)
- [x] Hologram renderer: WebGL shader (red, wire grid, glow, scanlines, tearing, RGB split) that reacts to her voice
- [x] Original character images for neutral, speaking, angry and victory; expressions guessed from the game → [redqueen-visuals.md](redqueen-visuals.md)
- [x] Difficulty tuned: a strong argument gives +50 trust, so two arguments win

## Phase 1: remaining (laptop)

- [x] **Pre-recorded lines generated** in English and German with `npm run voicelines` (only new or changed lines, blocked lines are reported).
- [x] **Pre-recorded lines in the game:** intro while the session connects (timer starts after it), 60/30/10 s warnings, fail line, "Reset case" button. Mic and her live voice are muted while a line plays.
- [ ] Decide whether the last 10 s (countdown) should stay muted for the player, or whether the countdown should be shorter.
- [x] **Case flow:** standby logo → vial removed (alarm + case computer, countdown from 10 s; the seal "unexpectedly" fails after 7 s) → "Seal failure… Escalating to the Red Queen" → startup animation while connecting → short intro → 3:00. Putting the vial back after the game plays the reset line.
- [x] **Standby screen:** rotating 3D logo plus the sample label (English/German). Kiosk mode with `?kiosk` (screen only, as on the phone); keys V (remove vial) and B (put back) stand in for the sensor.
- [ ] Optional: your own standby logo at `app/public/standby/logo.png` (git-ignored); it then rotates instead of the original containment emblem. Transparent PNG, roughly 5:6 portrait.
- [x] **Lid sequence dropped:** the old 2024 "case breached" lines when opening the lid are not used anymore. Everything starts with removing the vial.
- [ ] **Missing expression images:** `processing`, `interest`, `concession` (they currently fall back to neutral and victory).
- [ ] **Video clips** instead of still images (idle, talking, …). Prompts are in [redqueen-visuals.md](redqueen-visuals.md).
- [ ] **Pick the real clearance code** (currently the placeholder `ALPHA-77`) and design the printed prop.
- [ ] Optional: `mood` parameter on `set_trust`, if the guessed expressions turn out to be unreliable.
- [ ] Play more test rounds: latency, whether she calls `set_trust` reliably, difficulty, noise.

## Phase 2: old Android phone as screen, speaker and mic

Setup and build: [phone-setup.md](phone-setup.md).

- [x] Phone: Samsung Galaxy A40 (Android 11 at most).
- [x] **Capacitor app** (`app/android/`, `npm run phone`): kiosk view, screen kept on, fullscreen, portrait, mic permission at start, native Bluetooth with auto-reconnect and search. Builds with Android Studio's JDK 25, Gradle 9.2 and a Java 21 toolchain for the plugins.
- [x] **Secrets on the phone (option A):** `npm run phone:config` copies key, agent IDs and clearance code from `.env` into the app's private storage over USB; not in the APK, Android backup off. The app calls Mistral directly (CORS allows it).
- [x] Language: hold the standby screen for 2 s (remembered).
- [ ] First install and full test round on the phone.
- [ ] Hidden debug view on the phone (for now `chrome://inspect` over USB).
- [ ] Test with the main phone as hotspot; test mic and echo cancellation at party volume.
- [ ] Option B for later: a small server that holds the key, if the phone or APK is ever handed out.

## Phase 3: ESP32 and Bluetooth

- [x] Board: ESP32-WROOM-32 DevKit for testing (on COM14). The final case uses an **ESP32-C3 Super Mini**; wiring in [hardware.md](hardware.md).
- [x] **Case controller firmware** (`firmware/redqueen-case/`, see [firmware/README.md](../firmware/README.md)): VL53L1X vial sensor, drawer motor with limit switches and timeout, mist maker, ported light effects, override button, standalone mode, serial test commands. Flashed to the C3 (COM15) and tested over serial without hardware attached.
- [ ] Connect the app to the C3 and compare range and reconnecting with the WROOM.
- [ ] Test each part once it's wired: calibrate the vial sensor, set the motor speed and run times, check the mist maker and LEDs.
- [x] App drives the case: white lights until the seal breaks, then red/white blinking (fast during the seal failure) until the antidote is released. A win sends `DRAWER:OPEN`, the reset `DRAWER:CLOSE`. `ERR:…` and `DRAWER:STUCK` show in the console.
- [x] Once the seal has broken, putting the vial back is ignored; after the game it resets the case once her last line has finished.
- [ ] Test the full flow with the C3 and the real hardware.
- [x] **BLE test firmware** (`firmware/esp32-ble-test/`): Nordic UART Service, heartbeat `HB:<n>:<uptime>` every 2 s, BOOT button as fake vial (`VIAL:0/1`), `PING`/`PONG`, advertising restarts after a disconnect. Flash with arduino-cli (bundled with the Arduino IDE), core `esp32:esp32` 2.0.14.
- [x] **App side:** `CaseLink` with auto-reconnect (1, 2, 4, 8, 10 s) and a pulsing dot (green = heartbeats arriving, red = none for 5 s). The vial events drive the case flow.
- [x] **Tested on the laptop (2026-10-30):** connect via the dot, heartbeat pulse, BOOT button triggers the case flow, auto-reconnect after an ESP32 reset.
- [ ] Reconnect after a page reload: needs `navigator.bluetooth.getDevices()`, which this Chrome only offers behind `chrome://flags/#enable-web-bluetooth-new-permissions-backend`. Check on the phone; otherwise one tap on the dot after a reload.
- [ ] Sensors: vial contacts (closed while the vial is in, GPIO6) instead of the VL53L1X, hidden override button, "drawer closed" end switch. Lid switch: no lid sequence anymore, but the LEDs turn on white when the lid opens (in the firmware).
- [ ] Drawer: DC motor with rubber-band slip drive on a DRV8833, plus the mist maker (MOSFET) when it opens.

## Phase 4: hardware build

- [ ] Vial: coin cell, red LED and reed switch, so it lights up when taken out of the holder.
- [ ] Motorised antidote drawer (rubber-band slip drive, "drawer closed" switch) and mist maker, wired as in [hardware.md](hardware.md).
- [ ] Phone mount in the lid, wiring, power from the power bank to phone and ESP32.

## Phase 5: polish and publish

- [ ] Offline fallback: pre-recorded lines plus on-screen code keypad when there's no internet.
- [ ] **German version** (see below).
- [ ] Offline fallback lines in German are already generated (`RQ_05` to `RQ_14`, `RQ_18`).
- [ ] Repo cleanup: archive the 2024 ESP8266 code, move the GLaDOS lines, first commit, licence.
- [ ] README with photos and build guide.
- [ ] Final rehearsal in the built case, including pulling WiFi and Bluetooth mid-game.

## German version (later)

The goal is a hardware switch for English or German. What has to change:

- [x] **Persona:** German system prompt in `redqueen-persona.md` (formal "Sie", same rules and tools).
- [x] **Agent:** second agent `red-queen-de` with German speech recognition and vocabulary. `agent:sync` creates and updates both; the test console has a language dropdown.
- [x] **Voice:** the existing Red Queen voice speaks German out of the box (cross-lingual cloning), with a slight English accent that fits her. No second voice needed.
- [x] **Pre-recorded lines:** German versions of all 20 lines, generated.
- [x] **Clearance code:** German number words (eins, zwei, … sieben, fünf) are accepted.
- [ ] **App:** language chosen with a hidden gesture on the standby screen (long-press on the logo, only in standby, saved on the phone), with German UI text. No hardware switch.

## Notes

- **Mistral SDK quirks:** import the tools from `@mistralai/mistralai/extra/voice-agents/tools.js` (the package index pulls Node-only code into the browser), and call `session.connect()` after `initSession()`.
- Voice agents don't show up in Mistral Studio; the agent exists and can be fetched through the API.
- Film stills stay private: `reference/` and `RedQueenNeutral.png` are git-ignored and are never used as input for image generation.
- Secrets (API key, voice ID, agent ID, clearance code) live only in `.env`.
