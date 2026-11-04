import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GAME_RULES } from "../game/rules.js";
import { extractSystemPrompt } from "./config.js";

const persona = readFileSync(new URL("../../../docs/redqueen-persona.md", import.meta.url), "utf8");

describe("extractSystemPrompt", () => {
  it("reads the English prompt", () => {
    const prompt = extractSystemPrompt(persona, "en");
    expect(prompt).toContain("Speak English.");
    expect(prompt).toContain(`In ${GAME_RULES.timeLimitSeconds} seconds`);
    expect(prompt).not.toContain("{{");
  });

  it("reads Windows line endings without carriage returns", () => {
    const lf = persona.replace(/\r\n/g, "\n");
    const prompt = extractSystemPrompt(lf.replace(/\n/g, "\r\n"), "en");
    expect(prompt).not.toContain("\r");
    expect(prompt).toEqual(extractSystemPrompt(lf, "en"));
  });

  it("reads the German prompt", () => {
    const prompt = extractSystemPrompt(persona, "de");
    expect(prompt).toContain("Sprich Deutsch.");
    expect(prompt).toContain(`In ${GAME_RULES.timeLimitSeconds} Sekunden`);
    expect(prompt).not.toContain("{{");
  });

  it("uses the same tool names in both languages", () => {
    for (const language of ["en", "de"] as const) {
      const prompt = extractSystemPrompt(persona, language);
      for (const tool of ["set_trust", "verify_clearance_code", "release_antidote", "register_name"]) {
        expect(prompt).toContain(tool);
      }
    }
  });
});
