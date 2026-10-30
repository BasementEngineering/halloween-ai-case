import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VOICE_LINES } from "./voicelines.js";
import { parseVoiceLines, SPEAKERS } from "./voicelineScript.js";

const script = readFileSync(new URL("../../../docs/redqueen-voicelines.md", import.meta.url), "utf8");

describe("parseVoiceLines", () => {
  it("reads the lines of both speakers", () => {
    expect(parseVoiceLines(script, "computer", "en")).toHaveLength(4);
    expect(parseVoiceLines(script, "redqueen", "en")).toHaveLength(17);
    expect(parseVoiceLines(script, "redqueen", "en")[0]).toEqual({
      id: "RQ_01_INTRO",
      text: expect.stringContaining("I am the Red Queen"),
    });
    expect(parseVoiceLines(script, "computer", "de")[0].text).toContain("Virusprobe");
  });

  it("has the same IDs in both languages", () => {
    for (const speaker of SPEAKERS) {
      const english = parseVoiceLines(script, speaker, "en").map((l) => l.id);
      expect(parseVoiceLines(script, speaker, "de").map((l) => l.id)).toEqual(english);
    }
  });

  it("contains every line the app plays", () => {
    const ids = SPEAKERS.flatMap((speaker) => parseVoiceLines(script, speaker, "en").map((l) => l.id));
    for (const id of Object.values(VOICE_LINES).flat()) expect(ids).toContain(id);
  });
});
