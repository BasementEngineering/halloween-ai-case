# Resident Evil Case – Red Queen Edition

A Halloween prop: a Resident Evil-inspired case with a fake T-virus vial, sounds and lights. This year it gets an AI antagonist.

## The idea

1. **The case is opened.** The case computer (a GLaDOS-style voice) warns that the case has been breached.
2. **The vial is removed.** The Red Queen (a red, glitching hologram of a little girl) takes over the screen. She tells the player they've made a mistake and the virus is now active. The vial lights up red.
3. **3 minutes to survive.** The player talks to the Red Queen. They can persuade her (an on-screen trust meter shows how it's going) or find the clearance code hidden somewhere in the case.
4. **Success:** a drawer pops open with the antidote. **Failure:** the virus takes over.

## How it works (planned)

| Part | Role |
|---|---|
| Old Android phone | Display, speaker and mic. Runs a web app in Chrome: Red Queen video, glitch effects, conversation, game logic. |
| Mistral voice agent | Voxtral speech recognition, Mistral LLM, Voxtral voice. The agent calls tools in the app to update the trust meter, check the code and release the antidote. Fixed moments use pre-recorded lines in the same voice. |
| ESP32 | Reads the vial sensor, drives the LEDs and the drawer latch. Talks to the phone over Bluetooth Low Energy. |
| Main phone | WiFi hotspot for internet. |
| Power bank | Powers the phone and the ESP32. |

The Red Queen's look is pre-made video clips of an original character, with live WebGL effects on top: red tint, scanlines, screen tearing, RGB split. The effects react to her voice.

## Status

Work in progress, target 2026-11-15. Plans and to-dos: [docs/roadmap.md](docs/roadmap.md).

## Talking to the Red Queen (laptop)

1. Copy `.env.example` to `.env` and fill in the Mistral key, voice ID and clearance code.
2. In `app/`, run `npm install`, then `npm run agent:sync` once and after every change to the persona or agent config.
3. Run `npm run dev`, open <http://localhost:5173> in Chrome, click **Remove vial**, allow the mic, and talk.

Run `npm test` for the game-rule tests.

## Repository

| Path | Contents |
|---|---|
| `app/` | Red Queen web app (in progress). `npm run agent:sync` creates/updates the Mistral agent |
| [`firmware/`](firmware/README.md) | ESP32 firmware: case controller (C3) and BLE test (WROOM), protocol |
| `Halloween_Case/` | 2024 ESP8266 firmware (to be archived) |
| `Content/GladosVoicelines/` | 2024 voice lines, reused as the case computer's voice |
| [`oldcase.md`](oldcase.md) | How the 2024 case works |
| [`docs/redqueen-persona.md`](docs/redqueen-persona.md) | Red Queen character, game rules, system prompt, fixed lines |
| [`docs/redqueen-visuals.md`](docs/redqueen-visuals.md) | Character design and image/video prompts |
| [`docs/redqueen-voicelines.md`](docs/redqueen-voicelines.md) | 20 pre-recorded Red Queen lines |
| [`docs/phone-setup.md`](docs/phone-setup.md) | Android app for the phone in the case (Capacitor): setup, build, secrets |
| [`docs/hardware.md`](docs/hardware.md) | 2026 wiring: ESP32-C3 pin map, sensor, drawer, mist maker, power |
| [`docs/mistral-setup.md`](docs/mistral-setup.md) | Red Queen voice agent on Mistral (Voxtral) |
| [`docs/elevenlabs-setup.md`](docs/elevenlabs-setup.md) | Alternative: ElevenLabs agent (not used) |

## Disclaimer

Fan-made, non-commercial Halloween prop inspired by Resident Evil. Not affiliated with Capcom or the film studios. The Red Queen character and voice used here are original designs.
