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

- [ ] Find out the phone's model and Android version; a current Chrome is needed (WebRTC, Web Bluetooth, Wake Lock).
- [ ] Fullscreen layout without the test console, plus a hidden debug view.
- [ ] Keep the screen on (Wake Lock API); the phone runs from the power bank.
- [ ] Host the app (HTTPS) and move the session endpoint into a small serverless function, protected so strangers can't start sessions on our bill.
- [ ] Test with the main phone as hotspot; test mic and echo cancellation at party volume.

## Phase 3: ESP32 and Bluetooth

- [ ] Buy a plain ESP32 or ESP32-C3 board (the old ESP8266 has no Bluetooth).
- [ ] Firmware: BLE service with text commands (`LID:1`, `VIAL:0`, `LED:…`, `DRAWER:OPEN`).
- [ ] Sensors: reed switch under the vial, hidden override button, language switch. The lid switch is optional now (no lid sequence anymore); at most it could require a closed lid for the reset.
- [ ] Port the LED effects from `lights.h` and add a countdown effect.
- [ ] Drawer latch servo.
- [ ] Standalone fallback: lights and override button work without the phone.
- [ ] Web Bluetooth connection in the app, replacing the start button.

## Phase 4: hardware build

- [ ] Vial: coin cell, red LED and reed switch, so it lights up when taken out of the holder.
- [ ] Spring-loaded antidote drawer with servo latch.
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
- [ ] **App:** language chosen by the switch (via the ESP32), with German UI text.

## Notes

- **Mistral SDK quirks:** import the tools from `@mistralai/mistralai/extra/voice-agents/tools.js` (the package index pulls Node-only code into the browser), and call `session.connect()` after `initSession()`.
- Voice agents don't show up in Mistral Studio; the agent exists and can be fetched through the API.
- Film stills stay private: `reference/` and `RedQueenNeutral.png` are git-ignored and are never used as input for image generation.
- Secrets (API key, voice ID, agent ID, clearance code) live only in `.env`.
