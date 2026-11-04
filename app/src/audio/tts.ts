import type { Language } from "../agent/config.js";
import type { Speaker } from "./voicelineScript.js";

// Shared by `npm run voicelines` (laptop) and the setup screen (phone), so both generate
// the same lines the same way.

export const TTS_MODEL = "voxtral-mini-tts-3";

// The case computer (WARDEN-3) uses Mistral presets, the same in every account.
export const COMPUTER_VOICES: Record<Language, string> = {
  en: "voice_1788", // David, English (UK)
  de: "voice_481", // Heidi, German
};

export function voiceFor(speaker: Speaker, language: Language, redQueenVoice: string): string {
  return speaker === "redqueen" ? redQueenVoice : COMPUTER_VOICES[language];
}

// Fingerprint of model, voice and text, to tell which lines need generating again.
export async function lineHash(voiceId: string, text: string): Promise<string> {
  const data = new TextEncoder().encode(`${TTS_MODEL}|${voiceId}|${text}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
