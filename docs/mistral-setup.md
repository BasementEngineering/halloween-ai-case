# Mistral Voice Agent Setup

The Red Queen runs as a **Mistral voice agent**:

```
mic → Voxtral speech-to-text → Mistral LLM (+ our tools) → Voxtral TTS → speaker
```

The Voice Agents SDK handles the whole pipeline in real time, including turn-taking and interruptions. The fixed moments (hijack, time warnings, endings) are pre-recorded lines from [redqueen-voicelines.md](redqueen-voicelines.md), generated with the **same voice**, so live and pre-recorded speech sound alike. The persona and game rules are in [redqueen-persona.md](redqueen-persona.md).

Docs: <https://docs.mistral.ai/studio/audio/voice-agents/overview>

## 1. Account and costs

- Create an API key in Mistral AI Studio. Never commit it: it goes into `.env`.
- Voxtral TTS costs about $0.016 per 1,000 characters, so a game costs a few cents. Check current prices for speech-to-text and the LLM in Studio.
- Set a monthly spending limit in the billing settings.

## 2. Voice

- **Our voice:** a saved custom voice named "Red Queen". Its ID goes into `.env` as `RED_QUEEN_VOICE_ID`.
- Note the `voice_id` of the voice you picked. Preset voices have IDs like `voice_1787`, and saved or cloned voices have their own ID. British female presets include Mary (`voice_1787`), Sky (`voice_1786`) and Harriet (`voice_590`).
- TTS model: `voxtral-mini-tts-3` (Voxtral TTS 3, recommended).
- Use the same voice and model to generate the pre-recorded lines.

## 3. Agent configuration

Voice agents are created through the SDK (`client.audio.agents.create`). Each change creates a new version, and sessions use the latest version unless one is pinned. We keep the configuration in the repo and create or update the agent with a small script:

```
cd app
npm install
npm run agent:sync
```

The script reads `MISTRAL_API_KEY` and `RED_QUEEN_VOICE_ID` from `.env` and the system prompts from `docs/redqueen-persona.md`. It creates or updates one agent per language: `red-queen` (English) and `red-queen-de` (German, with German speech recognition). Both use the same voice. It writes their IDs to `.env` as `RED_QUEEN_AGENT_ID` and `RED_QUEEN_AGENT_ID_DE`. The app picks the agent by language when it creates a session. Run it again after every change to the prompt or the settings. The settings are in `app/src/agent/config.ts` and the tool declarations in `app/src/agent/tools.ts`.

| Setting | Value | Why |
|---|---|---|
| `llm.model` | `mistral-small-latest` | Fast. The replies are short. |
| `stt.model` | `voxtral-mini-transcribe-realtime-3` | Realtime speech-to-text |
| `stt.language` | `en` | Fixed language works better than auto-detection at a noisy party. `de` comes later. |
| `stt.context_bias` | `Red Queen`, `antidote`, `clearance`, `Umbrella`, … | Helps recognise prop vocabulary |
| `stt.turn_detection.start_threshold` | About 0.65 (default 0.5) | Party background noise shouldn't start a turn |
| `tts.model` | `voxtral-mini-tts-3` | |
| `tts.voice_id` | Your voice | |
| `instructions` | System prompt from [redqueen-persona.md](redqueen-persona.md#system-prompt) | Replace `{{time_limit}}` with `180`. Mistral has no prompt variables. |
| `welcome_message` | None | The pre-recorded `RQ_04_RULES` plays just before the session starts |
| `turn.allow_interruptions` | `true` | The player can interrupt her |
| `tools` | The three client tools below | |

### Client tools

The tools are declared on the agent, but only the declaration (name, description, parameters) is stored there. The handlers run in our app and have to be passed again when each session starts. If a tool has no handler, the SDK reports it as failed and fires an `unhandled_tool` event. So the tools don't work in a dashboard test.

```typescript
import { functionTool } from "@mistralai/mistralai/extra/voice-agents";
import { z } from "zod";

const setTrust = functionTool({
  name: "set_trust",
  description: "Call after every reply from the subject, before you answer. Sets your trust in the subject (0-100). Returns the remaining time.",
  parameters: z.object({
    value: z.number().describe("New trust score from 0 to 100."),
    reason: z.string().describe("Short reason for the change, a few words."),
  }),
  handler: ({ value, reason }) => game.setTrust(value, reason), // → { trust, seconds_left }
});

const verifyClearanceCode = functionTool({
  name: "verify_clearance_code",
  description: "Checks a clearance code the subject has said. Pass exactly what they said. Never guess codes yourself.",
  parameters: z.object({
    code: z.string().describe("The code exactly as the subject said it."),
  }),
  handler: ({ code }) => game.verifyCode(code), // → { valid, attempts_left }
});

const releaseAntidote = functionTool({
  name: "release_antidote",
  description: "Releases the antidote from the case. Only call this when trust is at least 80 or a valid clearance code was entered.",
  parameters: z.object({}),
  handler: () => game.releaseAntidote(), // → { granted, reason }
});
```

The app enforces the rules, not the LLM. `release_antidote` checks trust and the code itself and can refuse. The SDK has no documented way to push a message into a running session, so the remaining time reaches her through the `seconds_left` value that `set_trust` returns.

## 4. Running it in the browser

The API key must never reach the browser. The flow from Mistral's browser guide:

```
Browser --ask for session--> our server --sessions.create() with API key--> Mistral
Browser <--session id + token-- our server
Browser <======= audio in real time =======> Mistral
```

- **Laptop development:** a small endpoint in the Vite dev server reads the key from `.env` and creates sessions.
- **Phone (Phase 2):** the same endpoint as a small serverless function, protected so strangers can't start sessions on your bill.
- The page uses `initSession()` from `@mistralai/mistralai/extra/voice-agents/browser` and needs HTTPS or `localhost` for mic access.

### Events the app uses

| Event | Use |
|---|---|
| `agent_state_changed` (`listening` / `thinking` / `speaking`) | Switch the idle and talking clips; play the "processing" glitch while she's thinking |
| `transcript` | Debug overlay, and logging test games |
| `tool_call_ended` | Debug overlay |
| `audio_track` (`source: "remote"`) | Her voice as a `MediaStreamTrack`, routed through Web Audio for the pitch shift and the volume meter that drives the glitches |
| `error`, `disconnected` | Fallback to offline mode |

`session.setInputEnabled(false)` mutes the mic, for example during pre-recorded lines, or for push-to-talk if open listening doesn't work at the party.

## 5. To verify in step 1b

- The latency of a full turn
- That routing her voice through our own pitch shifter works with the remote track, and that echo cancellation still works
- Turn detection with background noise
- Whether she reliably calls `set_trust` on every turn
