const NUMBER_WORDS: Record<string, string> = {
  // English
  zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4",
  five: "5", six: "6", seven: "7", eight: "8", nine: "9",
  // German (umlauts are spelled out first, so "fünf" arrives as "fuenf")
  null: "0", eins: "1", ein: "1", zwei: "2", zwo: "2", drei: "3", vier: "4",
  fuenf: "5", sechs: "6", sieben: "7", acht: "8", neun: "9",
};

const UMLAUTS: Record<string, string> = { "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss" };

// Makes spoken and printed codes comparable: "Alpha seven-seven", "Alpha sieben sieben"
// and "ALPHA-77" all become "alpha77".
export function normalizeCode(code: string): string {
  return code
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => UMLAUTS[c])
    .split(/[^a-z0-9]+/)
    .map((word) => NUMBER_WORDS[word] ?? word)
    .join("");
}

export function codesMatch(spoken: string, expected: string): boolean {
  const normalized = normalizeCode(spoken);
  return normalized.length > 0 && normalized === normalizeCode(expected);
}

// Clearance codes are short and contain digits (like ALPHA-77). Anything else, such as a
// name, a project or a whole sentence the agent mistook for a code, is turned away without
// using up an attempt.
export const CODE_FORMAT = { maxWords: 4, maxLength: 16 } as const;

export function looksLikeCode(spoken: string): boolean {
  const words = spoken.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const normalized = normalizeCode(spoken);
  return (
    words.length > 0 &&
    words.length <= CODE_FORMAT.maxWords &&
    normalized.length <= CODE_FORMAT.maxLength &&
    /\d/.test(normalized)
  );
}
