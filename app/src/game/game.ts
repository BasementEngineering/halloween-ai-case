import type { ReleaseAntidoteResult, SetTrustResult, VerifyCodeResult } from "../agent/tools.js";
import { GAME_RULES } from "./rules.js";

export type GamePhase = "idle" | "running" | "won" | "failed";
export type WinReason = "trust" | "code";

export interface GameState {
  phase: GamePhase;
  trust: number;
  secondsLeft: number;
  codeAttemptsLeft: number;
  codeVerified: boolean;
  winReason?: WinReason;
  playerName?: string;
  // Seconds from the start of the game to the release, set once won.
  winSeconds?: number;
}

type Rules = { -readonly [K in keyof typeof GAME_RULES]: number };

// The rules of the Red Queen game. The app enforces them, not the LLM:
// the agent's tool calls end up here and can be refused.
export class RedQueenGame {
  private phase: GamePhase = "idle";
  private trust: number;
  private startedAt = 0;
  private codeAttemptsLeft: number;
  private codeVerified = false;
  private winReason?: WinReason;
  private playerName?: string;
  private winSeconds?: number;
  private readonly listeners = new Set<(state: GameState) => void>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly rules: Rules = GAME_RULES,
  ) {
    this.trust = rules.trustStart;
    this.codeAttemptsLeft = rules.codeAttempts;
  }

  get state(): GameState {
    return {
      phase: this.phase,
      trust: this.trust,
      secondsLeft: this.secondsLeft(),
      codeAttemptsLeft: this.codeAttemptsLeft,
      codeVerified: this.codeVerified,
      winReason: this.winReason,
      playerName: this.playerName,
      winSeconds: this.winSeconds,
    };
  }

  onChange(listener: (state: GameState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start() {
    this.phase = "running";
    this.trust = this.rules.trustStart;
    this.startedAt = this.now();
    this.codeAttemptsLeft = this.rules.codeAttempts;
    this.codeVerified = false;
    this.winReason = undefined;
    this.playerName = undefined;
    this.winSeconds = undefined;
    this.emit();
  }

  // Call regularly; ends the game when the time is up.
  tick(): GameState {
    if (this.phase === "running" && this.secondsLeft() <= 0) {
      this.phase = "failed";
      this.emit();
    }
    return this.state;
  }

  setTrust(value: number, _reason: string): SetTrustResult {
    if (this.phase === "running") {
      this.trust = Math.round(Math.min(100, Math.max(0, value)));
      this.emit();
    }
    return { trust: this.trust, seconds_left: this.secondsLeft() };
  }

  setPlayerName(name: string): { name: string } {
    const trimmed = name.trim().replace(/\s+/g, " ").slice(0, 40);
    if (this.phase === "running" && trimmed) {
      this.playerName = trimmed;
      this.emit();
    }
    return { name: this.playerName ?? "" };
  }

  get canTryCode(): boolean {
    return this.phase === "running" && this.codeAttemptsLeft > 0;
  }

  // Records the result of a code check (the check itself happens on the server).
  registerCodeAttempt(valid: boolean): VerifyCodeResult {
    if (!this.canTryCode) return { valid: false, attempts_left: this.codeAttemptsLeft };
    if (valid) {
      this.codeVerified = true;
    } else {
      this.codeAttemptsLeft--;
    }
    this.emit();
    return { valid, attempts_left: this.codeAttemptsLeft };
  }

  releaseAntidote(): ReleaseAntidoteResult {
    if (this.phase !== "running") {
      return { granted: false, reason: `game is ${this.phase}` };
    }
    if (this.codeVerified) {
      this.win("code");
    } else if (this.trust >= this.rules.trustToRelease) {
      this.win("trust");
    } else {
      return { granted: false, reason: `trust ${this.trust} is below ${this.rules.trustToRelease} and no valid code was entered` };
    }
    return { granted: true, reason: this.winReason === "code" ? "valid clearance code" : "trust threshold reached" };
  }

  private win(reason: WinReason) {
    this.phase = "won";
    this.winReason = reason;
    this.winSeconds = Math.round((this.now() - this.startedAt) / 100) / 10;
    this.emit();
  }

  private secondsLeft(): number {
    if (this.phase === "idle") return this.rules.timeLimitSeconds;
    const elapsed = (this.now() - this.startedAt) / 1000;
    return Math.max(0, Math.ceil(this.rules.timeLimitSeconds - elapsed));
  }

  private emit() {
    const state = this.state;
    for (const listener of this.listeners) listener(state);
  }
}
