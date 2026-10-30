import type { Language } from "../agent/config.js";

export type Speaker = "computer" | "redqueen";
export type VoiceLine = { id: string; text: string };

// Section headings in docs/redqueen-voicelines.md
const SECTIONS: Record<Speaker, Record<Language, string>> = {
  computer: { en: "## Case computer – English", de: "## Case computer – Deutsch" },
  redqueen: { en: "## Red Queen – English", de: "## Red Queen – Deutsch" },
};

export const SPEAKERS: Speaker[] = ["computer", "redqueen"];

// Reads the lines of one speaker and language from the table rows `| \`ID\` | When | Line |`.
export function parseVoiceLines(markdown: string, speaker: Speaker, language: Language): VoiceLine[] {
  const heading = SECTIONS[speaker][language];
  const start = markdown.indexOf(`\n${heading}\n`);
  if (start < 0) throw new Error(`Section "${heading}" not found`);
  const end = markdown.indexOf("\n## ", start + 1);
  const section = markdown.slice(start, end < 0 ? undefined : end);

  const lines: VoiceLine[] = [];
  for (const row of section.matchAll(/^\| `((?:RQ|SYS)_\w+)` \|[^|]*\|(.+)\|\s*$/gm)) {
    lines.push({ id: row[1], text: row[2].trim() });
  }
  return lines;
}
