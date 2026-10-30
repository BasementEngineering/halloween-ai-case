import type { AudioSessionCreateResponse } from "@mistralai/mistralai/models/components";
import type { BrowserVoiceEventMap, VoiceAgentSession } from "@mistralai/mistralai/extra/voice-agents";
import { initSession } from "@mistralai/mistralai/extra/voice-agents/browser";
import type { Language } from "./agent/config.js";
import { createRedQueenTools } from "./agent/tools.js";
import { playAlert } from "./audio/alert.js";
import { VOICE_LINES, VoiceLinePlayer, WARNINGS } from "./audio/voicelines.js";
import { RedQueenGame, type GameState } from "./game/game.js";
import { GAME_RULES } from "./game/rules.js";
import { runBootSequence } from "./render/boot.js";
import { buildEmblem, showSpecimen } from "./render/standby.js";
import { CaseLink } from "./hardware/caseLink.js";
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

type CasePhase = "standby" | "alert" | "escalating" | "game" | "over";

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
  mic: $<HTMLInputElement>("mic"),
  transcript: $("transcript"),
  events: $("events"),
  overlay: $("overlay"),
  overlayTitle: $("overlay-title"),
  overlayText: $("overlay-text"),
};

// The countdown promises 10 seconds to put the vial back, but the seal
// "unexpectedly" fails after 7 and the Red Queen takes over anyway.
const GRACE_SECONDS = 10;
const SEAL_FAILS_AFTER_SECONDS = 7;
// Max time to let her finish her last line after the game has ended.
const FINAL_LINE_TIMEOUT_MS = 15_000;

const game = new RedQueenGame();
const picker = new ExpressionPicker();
const hologram = new HologramRenderer(ui.screen);
const voiceMeter = new VoiceMeter();
const voiceLines = new VoiceLinePlayer(voiceMeter);
const caseLink = new CaseLink();
let casePhase: CasePhase = "standby";
let session: VoiceAgentSession<BrowserVoiceEventMap> | null = null;
let ticker: number | undefined;
let graceTimer: number | undefined;
// The agent's real state; the hologram ignores it while a pre-recorded line plays.
let agentState: Parameters<ExpressionPicker["setAgentState"]>[0] = "idle";
let scriptedLine = false;
const warningsPlayed = new Set<string>();

ui.trustThreshold.style.left = `${GAME_RULES.trustToRelease}%`;
renderState(game.state);
game.onChange(renderState);
game.onChange((state) => picker.setPhase(state.phase));
// ?kiosk shows only the screen, as on the phone in the case; otherwise the test console is next to it.
document.body.classList.toggle("kiosk", new URLSearchParams(location.search).has("kiosk"));
buildEmblem(ui.emblem);
setCasePhase("standby");

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
ui.language.addEventListener("change", () => showSpecimen(ui.specimen, ui.language.value as Language));

// The ESP32 in the case: the dot shows whether heartbeats arrive, the vial sensor drives the game.
ui.caseDot.addEventListener("click", () => {
  if (caseLink.status === "disconnected") caseLink.pick();
});
caseLink.onStatus((status) => {
  ui.caseStatus.textContent = `case: ${status}`;
  renderCaseDot();
});
caseLink.onMessage((message) => {
  if (message.type === "heartbeat") {
    ui.caseStatus.textContent = `case: HB #${message.counter} (up ${message.uptimeSeconds} s)`;
    renderCaseDot();
    // Restart the pulse animation for every heartbeat.
    ui.caseDot.classList.remove("beat");
    void ui.caseDot.offsetWidth;
    ui.caseDot.classList.add("beat");
  } else if (message.type === "unknown") {
    logEvent(`case: unknown message "${message.line}"`);
  }
});
caseLink.onVial((inPlace) => {
  logEvent(`case: vial ${inPlace ? "put back" : "removed"}`);
  if (inPlace) returnVial();
  else if (casePhase === "standby") removeVial();
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
  if (e.key.toLowerCase() === "v" && casePhase === "standby") removeVial();
  if (e.key.toLowerCase() === "b") returnVial();
});

function setCasePhase(phase: CasePhase) {
  casePhase = phase;
  ui.screenBox.className = `screen ${phase}`;
  ui.removeVial.disabled = phase !== "standby";
  ui.returnVial.disabled = phase !== "alert" && phase !== "over";
  ui.stop.disabled = phase === "standby" || phase === "over";
  ui.language.disabled = phase !== "standby";
  // Replay the label's fade-in whenever the standby screen comes back.
  if (phase === "standby") showSpecimen(ui.specimen, ui.language.value as Language);
}

// The case computer raises the alarm; the player has a few seconds to undo it.
async function removeVial() {
  setCasePhase("alert");
  ui.overlay.hidden = true;
  voiceMeter.resume();
  voiceLines.language = ui.language.value as Language;

  await playAlert();
  if (casePhase !== "alert") return;
  await voiceLines.play(VOICE_LINES.vialRemoved);
  if (casePhase !== "alert") return;

  const started = performance.now();
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
  update();
  graceTimer = window.setInterval(update, 200);
}

async function returnVial() {
  if (casePhase === "alert") {
    window.clearInterval(graceTimer);
    ui.grace.hidden = true;
    voiceLines.stop();
    setCasePhase("standby");
    await voiceLines.play(VOICE_LINES.vialReturned);
  } else if (casePhase === "over") {
    resetCase();
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
      logEvent(`set_trust ${value} – ${reason}`);
      return result;
    },
    verifyClearanceCode: async (code) => {
      if (!game.canTryCode) {
        logEvent(`verify_clearance_code "${code}" → locked`);
        return { valid: false, attempts_left: game.state.codeAttemptsLeft };
      }
      const { valid } = await postJson<{ valid: boolean }>("/api/verify-code", { code });
      const result = game.registerCodeAttempt(valid);
      picker.onCodeResult(valid);
      logEvent(`verify_clearance_code "${code}" → ${valid ? "VALID" : "invalid"}, ${result.attempts_left} left`);
      return result;
    },
    releaseAntidote: () => {
      const result = game.releaseAntidote();
      logEvent(`release_antidote → ${result.granted ? "GRANTED" : "denied"} (${result.reason})`);
      return result;
    },
  });

  try {
    session = await initSession({
      tools,
      createSession: async (declarations) => {
        const raw = await postJson<any>("/api/voice-session", { tools: declarations, language: ui.language.value });
        return { ...raw, createdAt: new Date(raw.createdAt), expiresAt: new Date(raw.expiresAt) } as AudioSessionCreateResponse;
      },
      deleteSession: async (sessionId) => {
        await fetch(`/api/voice-session?sessionId=${encodeURIComponent(sessionId)}`, { method: "DELETE" });
      },
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
  ui.overlay.hidden = true;
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
    hologram.burst(1);
    voiceLines.stop();
    endSession("time is up").then(() => playScripted(VOICE_LINES.fail));
  } else if (state.phase === "won") {
    stopTicker();
    setCasePhase("over");
    const how = state.winReason === "code" ? "Valid clearance code." : `Trust reached ${state.trust}.`;
    showOverlay("won", "ANTIDOTE RELEASED", `${how} (drawer would open now)`);
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
}

function stopTicker() {
  if (ticker !== undefined) window.clearInterval(ticker);
  ticker = undefined;
}

function renderState(state: GameState) {
  const minutes = Math.floor(state.secondsLeft / 60);
  const seconds = String(state.secondsLeft % 60).padStart(2, "0");
  ui.timer.textContent = `${minutes}:${seconds}`;
  ui.timer.classList.toggle("low", state.phase === "running" && state.secondsLeft <= 30);
  ui.trustValue.textContent = String(state.trust);
  ui.trustFill.style.width = `${state.trust}%`;
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

function showOverlay(kind: "won" | "failed", title: string, text: string) {
  ui.overlay.className = `overlay ${kind}`;
  ui.overlayTitle.textContent = title;
  ui.overlayText.textContent = text;
  ui.overlay.hidden = false;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${url}: ${response.status} ${await response.text()}`);
  return response.json() as Promise<T>;
}
