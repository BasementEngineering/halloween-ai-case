// Game rules, see docs/redqueen-persona.md#game-rules-what-the-app-enforces
export const GAME_RULES = {
  timeLimitSeconds: 180,
  trustStart: 10,
  trustToRelease: 80,
  codeAttempts: 3,
} as const;
