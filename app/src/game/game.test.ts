import { describe, expect, it } from "vitest";
import { codesMatch, normalizeCode } from "./code.js";
import { RedQueenGame } from "./game.js";
import { GAME_RULES } from "./rules.js";

function createGame() {
  let time = 0;
  const game = new RedQueenGame(() => time);
  return { game, advance: (seconds: number) => (time += seconds * 1000) };
}

describe("RedQueenGame", () => {
  it("starts with the configured trust and full time", () => {
    const { game } = createGame();
    game.start();
    expect(game.state).toMatchObject({
      phase: "running",
      trust: GAME_RULES.trustStart,
      secondsLeft: GAME_RULES.timeLimitSeconds,
      codeAttemptsLeft: GAME_RULES.codeAttempts,
    });
  });

  it("fails when the time runs out", () => {
    const { game, advance } = createGame();
    game.start();
    advance(GAME_RULES.timeLimitSeconds - 1);
    expect(game.tick().phase).toBe("running");
    advance(1);
    expect(game.tick()).toMatchObject({ phase: "failed", secondsLeft: 0 });
  });

  it("clamps trust and reports the remaining time", () => {
    const { game, advance } = createGame();
    game.start();
    advance(30);
    expect(game.setTrust(-5, "test")).toEqual({ trust: 0, seconds_left: GAME_RULES.timeLimitSeconds - 30, antidote_released: false });
    expect(game.setTrust(150, "test").trust).toBe(100);
  });

  it("keeps the antidote locked below the trust threshold", () => {
    const { game } = createGame();
    game.start();
    expect(game.setTrust(GAME_RULES.trustToRelease - 1, "almost").antidote_released).toBe(false);
    expect(game.state.phase).toBe("running");
  });

  it("releases the antidote as soon as trust reaches the threshold", () => {
    const { game } = createGame();
    game.start();
    expect(game.setTrust(GAME_RULES.trustToRelease, "convinced").antidote_released).toBe(true);
    expect(game.state).toMatchObject({ phase: "won", winReason: "trust" });
  });

  it("keeps reporting the release on later trust calls", () => {
    const { game } = createGame();
    game.start();
    game.setTrust(100, "convinced");
    expect(game.setTrust(20, "changed her mind")).toMatchObject({ trust: 100, antidote_released: true });
  });

  it("releases the antidote after a valid code, regardless of trust", () => {
    const { game } = createGame();
    game.start();
    expect(game.registerCodeAttempt(true)).toEqual({ valid: true, attempts_left: GAME_RULES.codeAttempts, antidote_released: true });
    expect(game.state).toMatchObject({ phase: "won", winReason: "code" });
  });

  it("locks the code path after too many wrong attempts", () => {
    const { game } = createGame();
    game.start();
    for (let i = 0; i < GAME_RULES.codeAttempts; i++) game.registerCodeAttempt(false);
    expect(game.canTryCode).toBe(false);
    expect(game.registerCodeAttempt(true)).toMatchObject({ valid: false, antidote_released: false });
    expect(game.state.phase).toBe("running");
  });

  it("ignores tool calls once the game is over", () => {
    const { game, advance } = createGame();
    game.start();
    advance(GAME_RULES.timeLimitSeconds);
    game.tick();
    expect(game.setTrust(100, "too late").antidote_released).toBe(false);
    expect(game.state.phase).toBe("failed");
  });
});

describe("clearance codes", () => {
  it("matches spoken and printed forms", () => {
    expect(normalizeCode("Alpha seven-seven")).toBe("alpha77");
    expect(codesMatch("alpha 7 7", "ALPHA-77")).toBe(true);
    expect(codesMatch("Alpha seven seven.", "ALPHA-7-7")).toBe(true);
  });

  it("understands German number words", () => {
    expect(codesMatch("Alpha sieben sieben", "ALPHA-77")).toBe(true);
    expect(normalizeCode("Bravo fünf null zwo")).toBe("bravo502");
  });

  it("rejects wrong and empty codes", () => {
    expect(codesMatch("alpha 78", "ALPHA-77")).toBe(false);
    expect(codesMatch("", "")).toBe(false);
  });
});
