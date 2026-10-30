import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { imageFor, type Expression } from "./expressions.js";

const ALL: Expression[] = ["neutral", "speaking", "processing", "angry", "interest", "victory", "concession"];

describe("imageFor", () => {
  it("uses specialised images where they exist", () => {
    expect(imageFor("angry")).toBe("/redqueen/angry.jpg");
    expect(imageFor("speaking")).toBe("/redqueen/speaking.jpg");
  });

  it("falls back to related images", () => {
    expect(imageFor("processing")).toBe("/redqueen/neutral.jpg");
    expect(imageFor("interest")).toBe("/redqueen/neutral.jpg");
    expect(imageFor("concession")).toBe("/redqueen/victory.jpg");
  });

  it("points every expression at an existing file", () => {
    for (const expression of ALL) {
      expect(existsSync(new URL(`../../public${imageFor(expression)}`, import.meta.url))).toBe(true);
    }
  });
});
