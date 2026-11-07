import { KeepAwake } from "@capacitor-community/keep-awake";
import { ScreenBrightness } from "@capacitor-community/screen-brightness";
import { Capacitor } from "@capacitor/core";
import type { BrowserVoiceEventMap, VoiceAgentSession } from "@mistralai/mistralai/extra/voice-agents";
import { initSession } from "@mistralai/mistralai/extra/voice-agents/browser";
import type { Language } from "./agent/config.js";
import { createRedQueenTools } from "./agent/tools.js";
import { playAlert, stopAlert } from "./audio/alert.js";
import { BUNDLED_VOICELINES, VOICE_LINES, VoiceLinePlayer, WARNINGS, voiceLineUrl } from "./audio/voicelines.js";
import { RedQueenGame, type GameState } from "./game/game.js";
import { GAME_RULES } from "./game/rules.js";
import { runBootSequence } from "./render/boot.js";
import { buildEmblem, showSpecimen } from "./render/standby.js";
import { CaseLink } from "./hardware/caseLink.js";
import { HardwareTestPanel } from "./hardware/testPanel.js";
import { looksLikeCode } from "./game/code.js";
import { Leaderboard, formatSeconds, type LeaderboardEntry } from "./game/leaderboard.js";
import { createBackend, readSavedConfig } from "./platform/backend.js";
import { SetupRequiredError } from "./platform/deviceConfig.js";
import type { SetupPanel } from "./platform/setupPanel.js";
import { HologramRenderer } from "./render/hologram.js";
import { ExpressionPicker } from "./render/mood.js";
import { VoiceMeter } from "./render/voiceMeter.js";

// Test console: the case flow with the Red Queen on the laptop. The buttons stand in
// for the vial sensor until the ESP32 is connected.
//
//   standby ──remove vial──▶ alert (shows 10 s, seal fails after 7) ──seal failure──▶ escalating
//      ▲                       │ returned within 7 s                       (startup animation)
//      │◀──────────────────────┘                                                 │
//      │                                                                          ▼
//      └──────── vial back (reset line) ◀── over (won / failed) ◀────────────── game (3:00)
//
// Once the seal has broken, putting the vial back is ignored until the game is over
// and her last line has finished. Case lights: white, then a red countdown on the
// inside LEDs in step with the on-screen countdown, red/white blinking from the seal
// failure until the antidote is released.

type CasePhase = "standby" | "alert" | "escalating" | "game" | "over";
type CaseLights = "IDLE" | "ALERT" | "ESCALATE" | `COUNTDOWN:${number}`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const ui = {
  screenBox: document.querySelector<HTMLElement>(".screen")!,
  screen: $<HTMLCanvasElement>("screen"),
  emblem: $("emblem"),
  specimen: $("specimen"),
  grace: $("grace"),
  caseDot: $<HTMLButtonElement>("case-dot"),
  caseStatus: $("case-status"),
  boot: $("boot"),
  screenTimer: $("screen-timer"),
  screenTrustFill: $("screen-trust-fill"),
  screenTrustThreshold: $("screen-trust-threshold"),
  notice: $("notice"),
  connection: $("connection"),
  agentState: $("agent-state"),
  timer: $("timer"),
  trustValue: $("trust-value"),
  trustFill: $("trust-fill"),
  trustThreshold: $("trust-threshold"),
  codeStatus: $("code-status"),
  language: $<HTMLSelectElement>("language"),
  removeVial: $<HTMLButtonElement>("remove-vial"),
  returnVial: $<HTMLButtonElement>("return-vial"),
  stop: $<HTMLButtonElement>("stop"),
  hardwareTest: $<HTMLButtonElement>("hardware-test"),
  mic: $<HTMLInputElement>("mic"),
  transcript: $("transcript"),
  events: $("events"),
  overlay: $("overlay"),
  overlayTitle: $("overlay-title"),
  overlayText: $("overlay-text"),
  overlayBoard: $("overlay-board"),
};

// The countdown promises 10 seconds to put the vial back, but the seal
// "unexpectedly" fails after 7 and the Red Queen takes over anyway.
const GRACE_SECONDS = 10;
// The lid must stay closed this long before it ends a game (same as LID_RESET_MS in the firmware).
const LID_RESET_MS = 1000;
const SEAL_FAILS_AFTER_SECONDS = 7;
// Max time to let her finish her last line after the game has ended.
const FINAL_LINE_TIMEOUT_MS = 15_000;
// Rows of the leaderboard on the win screen.
const LEADERBOARD_ROWS = 5;
// Hidden gesture: holding the standby screen this long switches the language.
const LANGUAGE_HOLD_MS = 2000;
const LANGUAGE_KEY = "redqueen.language";
// Hidden gesture for the hardware test: this many quick taps in the empty top-left corner.
const HARDWARE_TEST_TAPS = 5;
const HARDWARE_TEST_TAP_WINDOW_MS = 2000;
const HARDWARE_TEST_CORNER_PX = 80;
const native = Capacitor.isNativePlatform();

const game = new RedQueenGame();
const picker = new ExpressionPicker();
const hologram = new HologramRenderer(ui.screen);
const voiceMeter = new VoiceMeter();
const voiceLines = new VoiceLinePlayer(voiceMeter);
const caseLink = new CaseLink();
const hardwareTest = new HardwareTestPanel(caseLink);
const leaderboard = new Leaderboard();
const backend = createBackend();
let casePhase: CasePhase = "standby";
let setupPanel: SetupPanel | undefined;
// Lid state from the case (LID:0/1), and whether the screen sleeps because it's closed.
let lidOpen = true;
let asleep = false;
let lidResetTimer: number | undefined;
// Last vial state from the case: opening the lid with the vial out starts the run.
let vialOut = false;
let session: VoiceAgentSession<BrowserVoiceEventMap> | null = null;
let ticker: number | undefined;
let graceTimer: number | undefined;
// Counts vial removals, so a removal sequence still waiting on a sound stops once the
// vial was put back (and maybe pulled again) in the meantime.
let removalRun = 0;
// The agent's real state; the hologram ignores it while a pre-recorded line plays.
let agentState: Parameters<ExpressionPicker["setAgentState"]>[0] = "idle";
let scriptedLine = false;
const warningsPlayed = new Set<string>();
let caseLights: CaseLights = "IDLE";
// The vial went back while she was still saying her last line; reset once she's done.
let resetWhenDone = false;

ui.trustThreshold.style.left = `${GAME_RULES.trustToRelease}%`;
ui.screenTrustThreshold.style.left = `${GAME_RULES.trustToRelease}%`;
renderState(game.state);
game.onChange(renderState);
game.onChange((state) => picker.setPhase(state.phase));
// The phone app and ?kiosk show only the screen; otherwise the test console is next to it.
document.body.classList.toggle("kiosk", native || new URLSearchParams(location.search).has("kiosk"));
ui.language.value = localStorage.getItem(LANGUAGE_KEY) ?? "en";
buildEmblem(ui.emblem);
setCasePhase("standby");
backend.catch((error) => {
  showNotice(String(error.message ?? error));
  // On the phone a missing or incomplete config opens the setup screen straight away.
  if (native && error instanceof SetupRequiredError) openSetup(error.message);
});
if (native) {
  hardwareTest.onSetup(() => {
    closeHardwareTest();
    openSetup();
  });
}
if (native) startOnPhone();
if (native) prepareVoiceLines();

requestAnimationFrame(function updateHologram() {
  hologram.setVoiceLevel(voiceMeter.read());
  hologram.setExpression(picker.current);
  requestAnimationFrame(updateHologram);
});

ui.removeVial.addEventListener("click", removeVial);
ui.returnVial.addEventListener("click", returnVial);
ui.stop.addEventListener("click", abort);
ui.mic.addEventListener("change", () => session?.setInputEnabled(ui.mic.checked));
ui.overlay.addEventListener("click", () => (ui.overlay.hidden = true));
ui.language.addEventListener("change", () => setLanguage(ui.language.value as Language));

// Hidden gesture for the phone: hold the standby screen to switch between English and German.
let languageHold: number | undefined;
ui.screenBox.addEventListener("pointerdown", (e) => {
  if (casePhase !== "standby" || e.target === ui.caseDot) return;
  languageHold = window.setTimeout(() => setLanguage(ui.language.value === "en" ? "de" : "en"), LANGUAGE_HOLD_MS);
});
for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
  ui.screenBox.addEventListener(type, () => window.clearTimeout(languageHold));
}

// The ESP32 in the case: the dot shows whether heartbeats arrive, the vial sensor drives the game.
ui.caseDot.addEventListener("click", () => {
  if (caseLink.status === "disconnected") caseLink.pick();
});

// Hardware test: from the console button, with ?test, or (on the phone) by tapping the
// top-left corner of the screen 5 times within 2 s. Nothing on screen marks the spot.
let cornerTaps: number[] = [];
ui.screenBox.addEventListener("pointerdown", (e) => {
  const box = ui.screenBox.getBoundingClientRect();
  const inCorner = e.clientX - box.left < HARDWARE_TEST_CORNER_PX && e.clientY - box.top < HARDWARE_TEST_CORNER_PX;
  if (!inCorner) {
    cornerTaps = [];
    return;
  }
  const now = performance.now();
  cornerTaps = [...cornerTaps.filter((t) => now - t < HARDWARE_TEST_TAP_WINDOW_MS), now];
  if (cornerTaps.length >= HARDWARE_TEST_TAPS) {
    cornerTaps = [];
    window.clearTimeout(languageHold);
    openHardwareTest();
  }
});
ui.hardwareTest.addEventListener("click", openHardwareTest);
hardwareTest.onClose(closeHardwareTest);
if (new URLSearchParams(location.search).has("test")) openHardwareTest();

// Only from standby, so a running game isn't disturbed. While it's open the vial
// doesn't start the game, and the panel owns the drawer, mist and lights.
function openHardwareTest() {
  if (casePhase !== "standby") {
    logEvent("hardware test: only possible in standby", "error");
    return;
  }
  ui.hardwareTest.disabled = true;
  logEvent("hardware test: open");
  hardwareTest.open();
  updateSleep();
}

// On the phone the voice lines come from the player's own Mistral account (setup screen).
// The APK ships only the case computer's lines, so without hers the setup screen opens.
async function prepareVoiceLines() {
  const { generatedVoiceLineBase, missingRedQueenLines } = await import("./audio/deviceVoiceLines.js");
  voiceLines.sources = [await generatedVoiceLineBase(), BUNDLED_VOICELINES];
  try {
    await backend;
  } catch {
    return; // no config: the setup screen is already open
  }
  const { voiceId } = await readSavedConfig();
  const missing = voiceId ? await missingRedQueenLines(voiceId) : 1;
  if (missing === 0) return;
  // A build from the repo may bundle her lines (npm run voicelines); then they're enough.
  const bundled = await fetch(voiceLineUrl("en", VOICE_LINES.intro[0])).then((r) => r.ok, () => false);
  if (!bundled) openSetup(`Her voice lines are missing (${voiceId ? missing : "no voice chosen"}): generate them here.`);
}

// Setup screen (phone only): Mistral key, voice and clearance code. Loaded on demand,
// since it pulls in the persona and the agent setup.
async function openSetup(reason?: string) {
  if (casePhase !== "standby") return;
  if (!setupPanel) {
    const { SetupPanel } = await import("./platform/setupPanel.js");
    setupPanel = new SetupPanel();
    setupPanel.onClose(() => {
      setupPanel?.close();
      updateSleep();
    });
  }
  logEvent("setup: open");
  await setupPanel.open(reason);
  updateSleep();
}

// Hands the case back to the game: mist off, default brightness, the game's lights.
function closeHardwareTest() {
  hardwareTest.close();
  ui.hardwareTest.disabled = casePhase !== "standby";
  sendToCase("MIST:OFF");
  sendToCase("LED:BRIGHTNESS");
  sendToCase(`LED:${caseLights}`);
  logEvent("hardware test: closed");
  updateSleep();
}
caseLink.onStatus((status) => {
  ui.caseStatus.textContent = `case: ${status}`;
  renderCaseDot();
  if (status === "connected") sendToCase(`LED:${caseLights}`);
  // Without a link the lid is unknown: wake up, so the case never sits dark by mistake.
  if (status !== "connected") lidOpen = true;
  updateSleep();
});
caseLink.onMessage((message) => {
  if (message.type === "heartbeat") {
    ui.caseStatus.textContent = `case: HB #${message.counter} (up ${message.uptimeSeconds} s)`;
    renderCaseDot();
    // Restart the pulse animation for every heartbeat.
    ui.caseDot.classList.remove("beat");
    void ui.caseDot.offsetWidth;
    ui.caseDot.classList.add("beat");
  } else if (message.type === "error") {
    logEvent(`case: ERR:${message.text}`, "error");
  } else if (message.type === "drawer") {
    logEvent(`case: DRAWER:${message.state}`, message.state === "STUCK" ? "error" : "");
  } else if (message.type === "lid") {
    onLid(message.open);
  }
});
caseLink.onVial((inPlace) => {
  logEvent(`case: vial ${inPlace ? "put back" : "removed"}`);
  vialOut = !inPlace;
  if (hardwareTest.isOpen || setupPanel?.isOpen) return;
  if (inPlace) returnVial();
  else {
    resetWhenDone = false;
    // With the lid closed nobody sees the screen: the run starts when it's opened.
    if (casePhase === "standby" && lidOpen) removeVial();
  }
});
caseLink.onLog((text) => logEvent(`case: ${text}`));
if (caseLink.status === "unsupported") ui.caseStatus.textContent = "case: no Web Bluetooth";
window.setInterval(renderCaseDot, 500);
caseLink.restore();

function renderCaseDot() {
  ui.caseDot.classList.toggle("alive", caseLink.alive);
  ui.caseDot.title = caseLink.alive ? "Case connected" : `Case ${caseLink.status} – click to connect`;
}

// Keyboard stand-ins for the vial sensor until the ESP32 is connected: V = remove, B = put back.
document.addEventListener("keydown", (e) => {
  if (e.repeat || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (hardwareTest.isOpen) return;
  if (e.key.toLowerCase() === "v" && casePhase === "standby") removeVial();
  if (e.key.toLowerCase() === "b") returnVial();
});

// The phone in the case: screen always on, and the mic permission up front
// (not in the middle of the first game).
async function startOnPhone() {
  await KeepAwake.keepAwake().catch((error) => logEvent(`keep awake failed: ${error}`, "error"));
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
  } catch (error) {
    showNotice(`no microphone access: ${error}`);
  }
}

// Lid closed in standby: the screen goes black and as dim as it gets. The app keeps
// running and stays connected, so opening the lid wakes it at once. A real screen-off
// would let Android throttle the app, and then it might miss the lid or the vial.
// On the AMOLED screen of the phone, black pixels are switched off.
function onLid(open: boolean) {
  if (open === lidOpen) return;
  lidOpen = open;
  logEvent(`case: lid ${open ? "opened" : "closed"}`);
  window.clearTimeout(lidResetTimer);
  if (!open) lidResetTimer = window.setTimeout(resetFromLid, LID_RESET_MS);
  const wasAsleep = asleep;
  updateSleep();
  if (!open || casePhase !== "standby") return;
  if (vialOut && !hardwareTest.isOpen && !setupPanel?.isOpen) {
    // Opened with the vial still out: the normal run, as if it had just been removed.
    removeVial();
  } else if (!wasAsleep) {
    // Opening the case replays the label's fade-in, like switching the language.
    showSpecimen(ui.specimen, ui.language.value as Language);
  }
}

// The lid has stayed closed: the single safe exit. Whatever was going on ends silently,
// the drawer closes and the mist stops (the case does that by itself too), and the
// screen goes to sleep. Not while the hardware test or setup is open.
function resetFromLid() {
  if (lidOpen || hardwareTest.isOpen || setupPanel?.isOpen || casePhase === "standby") return;
  logEvent("lid closed: reset");
  sendToCase("DRAWER:CLOSE");
  sendToCase("MIST:OFF");
  resetWhenDone = false;
  ui.overlay.hidden = true;
  abort();
}

function updateSleep() {
  const sleep =
    !lidOpen && casePhase === "standby" && caseLink.status === "connected" && !hardwareTest.isOpen && !setupPanel?.isOpen;
  if (sleep === asleep) return;
  asleep = sleep;
  ui.screenBox.classList.toggle("asleep", sleep);
  logEvent(sleep ? "screen: asleep (lid closed)" : "screen: awake");
  // -1 hands the brightness back to the phone's own setting.
  if (native) ScreenBrightness.setBrightness({ brightness: sleep ? 0 : -1 }).catch((error) => logEvent(`brightness failed: ${error}`, "error"));
  if (!sleep && casePhase === "standby") showSpecimen(ui.specimen, ui.language.value as Language);
}

function setLanguage(language: Language) {
  ui.language.value = language;
  localStorage.setItem(LANGUAGE_KEY, language);
  // The label fades in again in the new language, which doubles as the confirmation.
  showSpecimen(ui.specimen, language);
  logEvent(`language: ${language}`);
}

function showNotice(text: string) {
  ui.notice.textContent = text;
  ui.notice.hidden = false;
  logEvent(text, "error");
}

function setCasePhase(phase: CasePhase) {
  casePhase = phase;
  if (phase === "standby" || phase === "alert") setCaseLights("IDLE");
  else if (phase === "escalating") setCaseLights("ESCALATE");
  else if (phase === "game") setCaseLights("ALERT");
  ui.screenBox.className = `screen ${phase}`;
  ui.removeVial.disabled = phase !== "standby";
  ui.returnVial.disabled = phase !== "alert" && phase !== "over";
  ui.stop.disabled = phase === "standby" || phase === "over";
  ui.hardwareTest.disabled = phase !== "standby" || hardwareTest.isOpen;
  ui.language.disabled = phase !== "standby";
  // Replay the label's fade-in whenever the standby screen comes back.
  if (phase === "standby") showSpecimen(ui.specimen, ui.language.value as Language);
  updateSleep();
}

// The case computer raises the alarm; the player has a few seconds to undo it.
async function removeVial() {
  const run = ++removalRun;
  const current = () => casePhase === "alert" && run === removalRun;
  setCasePhase("alert");
  ui.overlay.hidden = true;
  voiceMeter.resume();
  voiceLines.stop(); // e.g. the "vial returned" line from a moment ago
  voiceLines.language = ui.language.value as Language;

  await playAlert();
  if (!current()) return;
  await voiceLines.play(VOICE_LINES.vialRemoved);
  if (!current()) return;

  const started = performance.now();
  // The inside LEDs fill red over the same 10 s as the on-screen countdown.
  setCaseLights(`COUNTDOWN:${GRACE_SECONDS}`);
  const update = () => {
    const elapsed = (performance.now() - started) / 1000;
    if (casePhase !== "alert") {
      window.clearInterval(graceTimer);
      ui.grace.hidden = true;
      return;
    }
    if (elapsed >= SEAL_FAILS_AFTER_SECONDS) {
      window.clearInterval(graceTimer);
      sealFailure();
      return;
    }
    const count = document.createElement("strong");
    count.textContent = String(Math.ceil(GRACE_SECONDS - elapsed));
    ui.grace.replaceChildren("RETURN SAMPLE", count);
  };
  ui.grace.hidden = false;
  window.clearInterval(graceTimer);
  update();
  graceTimer = window.setInterval(update, 200);
}

async function returnVial() {
  if (casePhase === "alert") {
    removalRun++;
    window.clearInterval(graceTimer);
    ui.grace.hidden = true;
    stopAlert();
    voiceLines.stop();
    setCasePhase("standby");
    await voiceLines.play(VOICE_LINES.vialReturned);
  } else if (casePhase === "over") {
    if (session) {
      resetWhenDone = true;
      logEvent("vial put back: resetting after her last line");
    } else {
      resetCase();
    }
  } else if (casePhase === "escalating" || casePhase === "game") {
    logEvent("vial put back: ignored, the seal is broken");
  }
}

// The vial "fails" before the countdown ends; putting it back no longer helps.
async function sealFailure() {
  setCasePhase("escalating");
  hologram.burst(1);
  ui.grace.replaceChildren("SEAL FAILURE");
  ui.grace.classList.add("failure");
  await voiceLines.play(VOICE_LINES.sealFailure);
  ui.grace.hidden = true;
  ui.grace.classList.remove("failure");
  if (casePhase !== "escalating") return;
  await voiceLines.play(VOICE_LINES.escalating);
  if (casePhase !== "escalating") return;
  await startRedQueen();
}

// Startup animation while the session connects, then her intro, then the 3 minutes.
async function startRedQueen() {
  ui.transcript.replaceChildren();
  ui.events.replaceChildren();
  picker.reset(GAME_RULES.trustStart);
  game.reset(); // timer and trust meter show a fresh game during the boot, not the last one
  warningsPlayed.clear();

  const connected = connectSession();
  ui.screenBox.classList.add("booting");
  await runBootSequence(ui.boot, connected, (step) => {
    // She materialises step by step through the boot lines.
    hologram.burst(0.9);
    hologram.setPower(Math.min(0.6, 0.1 + step * 0.1), 300);
  });
  if (!(await connected) || casePhase !== "escalating") {
    if (casePhase === "escalating") abort();
    return;
  }

  setCasePhase("game");
  hologram.burst(1);
  hologram.setPower(1, 800);
  await playScripted(VOICE_LINES.intro);
  if (!session) return; // ended during the intro
  ui.mic.disabled = false;
  game.start();
  ticker = window.setInterval(onTick, 250);
}

async function connectSession(): Promise<boolean> {
  setConnection("connecting");
  const tools = createRedQueenTools({
    setTrust: (value, reason) => {
      const result = game.setTrust(value, reason);
      picker.onTrust(result.trust);
      logEvent(`set_trust ${value} – ${reason}${result.antidote_released ? " → ANTIDOTE RELEASED" : ""}`);
      return result;
    },
    verifyClearanceCode: async (code) => {
      if (game.canTryCode && !looksLikeCode(code)) {
        logEvent(`verify_clearance_code "${code}" → not a code, no attempt used`);
        return { valid: false, attempts_left: game.state.codeAttemptsLeft, not_a_code: true };
      }
      if (!game.canTryCode) {
        logEvent(`verify_clearance_code "${code}" → locked`);
        return { valid: false, attempts_left: game.state.codeAttemptsLeft };
      }
      const valid = await (await backend).verifyCode(code);
      const result = game.registerCodeAttempt(valid);
      logEvent(`verify_clearance_code "${code}" → ${valid ? "VALID" : "invalid"}, ${result.attempts_left} left`);
      return result;
    },
    registerName: (name) => {
      const result = game.setPlayerName(name);
      logEvent(`register_name "${result.name}"`);
      return result;
    },
  });

  try {
    session = await initSession({
      tools,
      createSession: async (declarations) => (await backend).createVoiceSession(declarations, ui.language.value as Language),
      deleteSession: async (sessionId) => (await backend).closeVoiceSession(sessionId),
    });
  } catch (error) {
    setConnection("error");
    logEvent(`could not start session: ${error}`, "error");
    return false;
  }

  session.on("disconnected", (e) => {
    setConnection("disconnected");
    logEvent(`disconnected${e.reason ? ` (${e.reason})` : ""}`);
    session = null;
    ui.mic.disabled = true;
    voiceMeter.detach();
    agentState = "idle";
    picker.setAgentState("idle");
    if (casePhase === "game" && game.state.phase === "running") abort();
  });
  session.on("agent_state_changed", (e) => {
    ui.agentState.textContent = e.state;
    agentState = e.state;
    if (!scriptedLine) picker.setAgentState(e.state);
  });
  session.on("audio_track", (e) => {
    if (e.source === "remote") voiceMeter.attach(e.track);
  });
  session.on("transcript", (e) => showTranscript(e.id, e.role, e.content, e.final));
  session.on("unhandled_tool", (e) => logEvent(`unhandled tool ${e.name}`, "error"));
  session.on("error", (e) => logEvent(`${e.source} error ${e.code}: ${e.message}${e.fatal ? " (fatal)" : ""}`, "error"));

  // initSession() only creates the session; connect() asks for the mic and joins it.
  try {
    await session.connect();
  } catch (error) {
    setConnection("error");
    logEvent(`could not connect: ${error}`, "error");
    await endSession("connect failed");
    return false;
  }
  if (!session) return false; // ended while waiting for the mic permission
  setConnection("connected");
  ui.mic.checked = true;
  // Nobody should talk to her before her intro has finished.
  await session.setInputEnabled(false);
  return true;
}

// Operator stop, or the connection dropped: back to standby.
function abort() {
  removalRun++;
  stopAlert();
  window.clearInterval(graceTimer);
  ui.grace.hidden = true;
  ui.boot.hidden = true;
  voiceLines.stop();
  hologram.setPower(0, 800);
  endSession("aborted");
  setCasePhase("standby");
}

// Plays pre-recorded lines. Meanwhile the mic and her live voice are muted,
// so nobody talks over the line and the agent doesn't hear it.
async function playScripted(ids: readonly string[]) {
  const current = session;
  await current?.setInputEnabled(false);
  if (current?.remoteTrack) current.remoteTrack.enabled = false;
  scriptedLine = true;
  picker.setAgentState("speaking");
  try {
    await voiceLines.play(ids);
  } finally {
    scriptedLine = false;
    picker.setAgentState(agentState);
    if (current && current === session) {
      if (current.remoteTrack) current.remoteTrack.enabled = true;
      await current.setInputEnabled(ui.mic.checked);
    }
  }
}

// Vial back after a game: she says goodbye, then the standby logo returns.
async function resetCase() {
  resetWhenDone = false;
  ui.overlay.hidden = true;
  sendToCase("DRAWER:CLOSE");
  ui.returnVial.disabled = true;
  picker.reset(GAME_RULES.trustStart);
  hologram.burst(0.6);
  hologram.setPower(1, 600);
  await playScripted(VOICE_LINES.reset);
  hologram.burst(1);
  hologram.setPower(0, 1500);
  setCasePhase("standby");
}

function onTick() {
  const state = game.tick();
  renderState(state);
  if (state.phase === "running") {
    const warning = WARNINGS.find((w) => state.secondsLeft <= w.secondsLeft && !warningsPlayed.has(w.line));
    if (warning) {
      // Mark all warnings that are due, so a late tick doesn't play two at once.
      for (const w of WARNINGS) if (state.secondsLeft <= w.secondsLeft) warningsPlayed.add(w.line);
      voiceLines.stop();
      playScripted([warning.line]);
    }
  } else if (state.phase === "failed") {
    stopTicker();
    setCasePhase("over");
    showOverlay("failed", "INFECTION COMPLETE", "The 3 minutes are up.");
    // The lights keep blinking: the case stays contaminated until it's reset.
    hologram.burst(1);
    voiceLines.stop();
    endSession("time is up").then(() => playScripted(VOICE_LINES.fail));
  } else if (state.phase === "won") {
    stopTicker();
    setCasePhase("over");
    const how = state.winReason === "code" ? "Valid clearance code." : `Trust reached ${state.trust}.`;
    showOverlay("won", "ANTIDOTE RELEASED", how);
    recordWin(state);
    setCaseLights("IDLE");
    if (caseLink.status === "connected") sendToCase("DRAWER:OPEN");
    else logEvent("case not connected: the drawer can't open", "error");
    endAfterFinalLine();
  }
}

// After a win she announces the release; close once she has finished speaking.
function endAfterFinalLine() {
  const current = session;
  if (!current) return;
  const finish = () => {
    // Glitch-out: she leaves the screen.
    hologram.burst(1);
    hologram.setPower(0, 2000);
    endSession("game won");
  };
  const timeout = window.setTimeout(finish, FINAL_LINE_TIMEOUT_MS);
  let spoke = false;
  const off = current.on("agent_state_changed", (e) => {
    if (e.state === "speaking") spoke = true;
    if (spoke && e.state === "listening") {
      off();
      window.clearTimeout(timeout);
      finish();
    }
  });
}

async function endSession(reason: string) {
  stopTicker();
  const current = session;
  session = null;
  if (!current) return;
  logEvent(`closing session: ${reason}`);
  await current.close();
  if (casePhase === "over" && resetWhenDone) resetCase();
}

function setCaseLights(effect: CaseLights) {
  caseLights = effect;
  sendToCase(`LED:${effect}`);
}

function sendToCase(line: string) {
  if (caseLink.status !== "connected") return;
  caseLink.send(line).catch((error) => logEvent(`case: sending ${line} failed: ${error}`, "error"));
}

function stopTicker() {
  if (ticker !== undefined) window.clearInterval(ticker);
  ticker = undefined;
}

function renderState(state: GameState) {
  const minutes = Math.floor(state.secondsLeft / 60);
  const seconds = String(state.secondsLeft % 60).padStart(2, "0");
  const low = state.phase === "running" && state.secondsLeft <= 30;
  for (const timer of [ui.timer, ui.screenTimer]) {
    timer.textContent = `${minutes}:${seconds}`;
    timer.classList.toggle("low", low);
  }
  ui.trustValue.textContent = String(state.trust);
  ui.trustFill.style.width = `${state.trust}%`;
  ui.screenTrustFill.style.width = `${state.trust}%`;
  ui.codeStatus.textContent = state.codeVerified
    ? "Code: VERIFIED"
    : state.codeAttemptsLeft > 0
      ? `Code attempts: ${state.codeAttemptsLeft}`
      : "Code: LOCKED";
}

function showTranscript(id: string, role: string, content: string, final: boolean) {
  let item = ui.transcript.querySelector<HTMLLIElement>(`[data-id="${CSS.escape(id)}"]`);
  if (!item) {
    item = document.createElement("li");
    item.dataset.id = id;
    ui.transcript.append(item);
  }
  item.className = `${role}${final ? "" : " partial"}`;
  item.textContent = content;
  ui.transcript.scrollTop = ui.transcript.scrollHeight;
}

function logEvent(text: string, kind = "") {
  const item = document.createElement("li");
  item.className = kind;
  item.textContent = `${new Date().toLocaleTimeString()}  ${text}`;
  ui.events.append(item);
  ui.events.scrollTop = ui.events.scrollHeight;
}

function setConnection(state: string) {
  ui.connection.textContent = state;
}

// Saves the win and shows the top of the leaderboard under the win message.
function recordWin(state: GameState) {
  const unknown = ui.language.value === "de" ? "Unbekanntes Subjekt" : "Unknown subject";
  const entry: LeaderboardEntry = {
    name: state.playerName ?? unknown,
    seconds: state.winSeconds ?? GAME_RULES.timeLimitSeconds - state.secondsLeft,
    trust: state.trust,
    via: state.winReason ?? "trust",
    at: new Date().toISOString(),
  };
  const rank = leaderboard.add(entry);
  logEvent(`leaderboard: ${entry.name}, ${formatSeconds(entry.seconds)}, rank ${rank}`);
  const rows = leaderboard.entries.slice(0, LEADERBOARD_ROWS).map((e, i) => [i + 1, e] as const);
  if (rank > LEADERBOARD_ROWS) rows.push([rank, entry]);
  ui.overlayBoard.replaceChildren(
    ...rows.map(([place, e]) => {
      const row = document.createElement("li");
      row.classList.toggle("current", place === rank);
      for (const [cls, text] of [
        ["place", `${place}.`],
        ["name", e.name],
        ["time", formatSeconds(e.seconds)],
        ["via", e.via === "code" ? "CODE" : `TRUST ${e.trust}`],
      ]) {
        const cell = document.createElement("span");
        cell.className = cls;
        cell.textContent = text;
        row.append(cell);
      }
      return row;
    }),
  );
  ui.overlayBoard.hidden = false;
}

function showOverlay(kind: "won" | "failed", title: string, text: string) {
  ui.overlayBoard.hidden = true;
  ui.overlay.className = `overlay ${kind}`;
  ui.overlayTitle.textContent = title;
  ui.overlayText.textContent = text;
  ui.overlay.hidden = false;
}
