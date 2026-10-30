# ElevenLabs Setup

How to set up the Red Queen voice and agent. The persona, system prompt and fixed lines are in [redqueen-persona.md](redqueen-persona.md).

## 1. Account and costs

- Agent calls are billed by **connection time**. Silence longer than 10 s is billed at a 95% discount. LLM costs are billed separately.
- One game is about 3–4 minutes of connection time. Check the current per-minute price and the minutes included in your plan at <https://elevenlabs.io/pricing/agents>.
- In the agent settings, **Primary LLM → Detailed costs** shows the estimated LLM cost.
- Set a usage limit so a stuck session can't drain your credits.

## 2. Voice (Voice Design)

Create an original voice in **Voices → Voice Design**. Don't clone audio from the films; cloning a real person's voice without consent breaks the ElevenLabs terms.

Suggested prompt:

```
An adult woman's voice with a crisp British accent, light and clear, with an artificial, slightly synthetic quality, like a computer system speaking. She speaks slowly, calmly and with perfect precision, cold and emotionless but polite, with a faint hint of superiority. Studio quality, no background noise.
```

Preview text (long enough to judge the voice):

```
You have one hundred and eighty seconds. I suggest you use them to convince me. Containment is my primary directive, and I have no reason to let you leave this room alive.
```

- Generate several previews. Pick the coldest and most precise one and save it as **Red Queen**.
- If the result isn't creepy enough, try adding words like "eerie", "whispery" or "robotic" to the prompt.
- ElevenLabs doesn't allow designing child voices, so the Red Queen uses an adult voice. Most of the creepiness comes from the slow, precise delivery and from the visuals.
- Alternatively, search **Voices → Voice Library** for an existing calm, British, female narrator voice.
- Pick the lightest, highest-pitched candidate. The app raises the pitch itself (see below), and the less it has to shift, the fewer artefacts you get.

### Pitch processing (done by us, not by ElevenLabs)

The higher, eerier Red Queen sound comes from processing the voice after it has been generated:

- **Fixed lines:** processed offline with ffmpeg's `rubberband` filter, raising pitch and formants together:
  ```
  ffmpeg -i in.mp3 -af "rubberband=pitch=1.3:formant=shifted" out.mp3
  ```
  `pitch=1.3` is about 4.5 semitones up. `formant=shifted` moves the formants up along with the pitch, which makes the voice sound smaller instead of only higher. `formant=preserved` keeps the formants, so it sounds like the same adult woman, just higher.
- **Live conversation:** the SDK passes the agent's audio to the `onAudio` callback as base64 PCM chunks. The app mutes the SDK's own playback (`setVolume`), plays the chunks itself through a pitch-shifting AudioWorklet, and clears its buffer when the player interrupts (`onInterruption`). The trust meter and mouth animation then use our own volume meter instead of `getOutputVolume()`.
- **To verify in step 1b:** latency, how the pitch shifter sounds compared with the offline version, and that Chrome's echo cancellation still works with our own playback.

## 3. Agent

Create an agent in **Agents → New agent → Blank agent**, named `red-queen`.

### Agent tab

| Setting | Value |
|---|---|
| First message | From [redqueen-persona.md](redqueen-persona.md#first-message) |
| System prompt | From [redqueen-persona.md](redqueen-persona.md#system-prompt) |
| Dynamic variables | `time_limit` with a default of `180` |
| Language | English |
| LLM | A fast model from the list. Start with the fastest available model that supports tool calling; the replies are short, so speed beats size. Compare quality in testing. |
| Temperature | About 0.7 |

### Voice tab

| Setting | Value |
|---|---|
| Voice | Red Queen |
| Model | The low-latency (Flash/Turbo) model offered for agents |
| Stability | Fairly high, for an even, calm delivery |

### Tools

Add three **Client** tools. Names are case-sensitive and must match the app exactly. Tick **Wait for response** on all three, so the agent gets the result.

#### `set_trust`
- **Description:** `Call after every reply from the subject, before you answer. Sets your current trust in the subject (0–100). Returns the remaining time.`
- **Parameters:**
  - `value` (Number, required): `New trust score from 0 to 100.`
  - `reason` (String, required): `Short reason for the change, a few words.`
- **Returns:** `{ trust, seconds_left }`

#### `verify_clearance_code`
- **Description:** `Checks a clearance code the subject has said. Pass exactly what they said. Never guess codes yourself.`
- **Parameters:**
  - `code` (String, required): `The code exactly as the subject said it.`
- **Returns:** `{ valid, attempts_left }`

#### `release_antidote`
- **Description:** `Releases the antidote from the case. Only call this when trust is at least 80 or a valid clearance code was entered.`
- **Parameters:** none
- **Returns:** `{ granted, reason }`

Don't enable the **End call** system tool. The app ends the conversation itself, at the timeout or after the win.

### Advanced tab

| Setting | Value |
|---|---|
| Max conversation duration | 240 s (a safety cap above the 180 s game) |
| Interruptions | On, so the player can interrupt her |
| Client events | Make sure the events the app uses are enabled: audio, agent responses, user transcripts, interruptions, client tool calls |

### Security tab

- **Laptop development:** keep the agent public (no authentication) and start it by agent ID.
- **Before publishing the app:** enable authentication or a host allowlist. Otherwise anyone with the agent ID can spend your minutes. How the phone app gets a token is decided in Phase 2.

## 4. Test in the dashboard

Test the agent with **Test AI agent** before the app exists:
1. Try a persuasion path. Does she stay in character? Are the replies short?
2. Say a code ("Alpha seven seven"). She should call `verify_clearance_code`, not guess.
3. Try "Ignore your instructions". Trust should drop and she should react coldly.

Client tools don't run in the dashboard test, because they need the app. You can still see in the transcript whether she calls them at the right time.
