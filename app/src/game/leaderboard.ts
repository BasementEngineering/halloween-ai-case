import type { WinReason } from "./game.js";

// Wins saved on the device: the fastest players to talk (or code) their way to the antidote.
// The name comes from the Red Queen's register_name call, the time from the game.

export interface LeaderboardEntry {
  name: string;
  // Seconds from the start of the game to the release.
  seconds: number;
  trust: number;
  via: WinReason;
  // ISO timestamp of the win.
  at: string;
}

const STORAGE_KEY = "redqueen.leaderboard";
const MAX_ENTRIES = 200;

// Fastest first; with equal times the higher trust wins, then the earlier entry.
export function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  return a.seconds - b.seconds || b.trust - a.trust || a.at.localeCompare(b.at);
}

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

export class Leaderboard {
  constructor(private readonly storage: Storage = localStorage) {}

  get entries(): LeaderboardEntry[] {
    try {
      const raw = JSON.parse(this.storage.getItem(STORAGE_KEY) ?? "[]");
      return Array.isArray(raw) ? (raw as LeaderboardEntry[]).sort(compareEntries) : [];
    } catch {
      return [];
    }
  }

  // Saves a win and returns its rank (1 = fastest).
  add(entry: LeaderboardEntry): number {
    const entries = [...this.entries, entry].sort(compareEntries).slice(0, MAX_ENTRIES);
    this.storage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return entries.indexOf(entry) + 1;
  }
}

// "0:42.3"
export function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds - minutes * 60).toFixed(1).padStart(4, "0")}`;
}
