import { describe, expect, it } from "vitest";
import { looksLikeCode } from "./code.js";
import { Leaderboard, formatSeconds, type LeaderboardEntry } from "./leaderboard.js";

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
}

function entry(name: string, seconds: number, trust = 80, at = "2026-11-04T12:00:00Z"): LeaderboardEntry {
  return { name, seconds, trust, via: "trust", at };
}

describe("Leaderboard", () => {
  it("ranks the fastest win first and returns the new entry's rank", () => {
    const board = new Leaderboard(memoryStorage());
    expect(board.add(entry("Ada", 60))).toBe(1);
    expect(board.add(entry("Bob", 30))).toBe(1);
    expect(board.add(entry("Cy", 90))).toBe(3);
    expect(board.entries.map((e) => e.name)).toEqual(["Bob", "Ada", "Cy"]);
  });

  it("breaks ties by higher trust", () => {
    const board = new Leaderboard(memoryStorage());
    board.add(entry("Low", 45, 80));
    expect(board.add(entry("High", 45, 95))).toBe(1);
  });

  it("survives broken storage", () => {
    const storage = memoryStorage();
    storage.setItem("redqueen.leaderboard", "not json");
    expect(new Leaderboard(storage).entries).toEqual([]);
  });

  it("formats times", () => {
    expect(formatSeconds(42.3)).toBe("0:42.3");
    expect(formatSeconds(125)).toBe("2:05.0");
  });
});

describe("looksLikeCode", () => {
  it("accepts short codes with digits, spoken or printed", () => {
    for (const code of ["ALPHA-77", "Alpha seven seven", "Alpha sieben sieben", "Bravo 12"]) {
      expect(looksLikeCode(code), code).toBe(true);
    }
  });

  it("turns away names, projects and sentences", () => {
    for (const text of [
      "Neue Viruskoffer",
      "Dr. Jane Doe",
      "an den Koffern, an den Gerätungs-Konferenzen, Arbeitszeit, keine Freigabe",
      "my code is one two three and I work in the lab",
      "",
    ]) {
      expect(looksLikeCode(text), text).toBe(false);
    }
  });
});
