import type { GamePhase } from "../game/game.js";
import type { Expression } from "./expressions.js";

export type AgentState = "initializing" | "idle" | "listening" | "thinking" | "speaking";

// How the expression is guessed from the game, see docs/redqueen-visuals.md#expressions
export const MOOD_RULES = {
  // Trust change per turn that counts as a strong reaction.
  angryTrustDrop: -10,
  // Calm replies give +10 and strong arguments +50 (see docs/redqueen-persona.md), so only real arguments count.
  interestTrustRise: 25,
  // How long a reaction (angry, interest) stays on her face.
  reactionHoldMs: 6000,
} as const;

export class ExpressionPicker {
  private agentState: AgentState = "idle";
  private phase: GamePhase = "idle";
  private lastTrust?: number;
  private reaction?: { expression: Expression; until: number };

  constructor(private readonly now: () => number = Date.now) {}

  get current(): Expression {
    if (this.phase === "failed") return "victory";
    if (this.phase === "won") return "concession";
    if (this.reaction && this.now() < this.reaction.until) return this.reaction.expression;
    if (this.agentState === "speaking") return "speaking";
    if (this.agentState === "thinking") return "processing";
    return "neutral";
  }

  reset(trust: number) {
    this.lastTrust = trust;
    this.reaction = undefined;
    this.phase = "idle";
  }

  setAgentState(state: AgentState) {
    this.agentState = state;
  }

  setPhase(phase: GamePhase) {
    this.phase = phase;
  }

  onTrust(trust: number) {
    const delta = this.lastTrust === undefined ? 0 : trust - this.lastTrust;
    this.lastTrust = trust;
    if (delta <= MOOD_RULES.angryTrustDrop) this.react("angry");
    else if (delta >= MOOD_RULES.interestTrustRise) this.react("interest");
  }

  private react(expression: Expression) {
    this.reaction = { expression, until: this.now() + MOOD_RULES.reactionHoldMs };
  }
}
