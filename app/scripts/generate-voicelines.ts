// Generates the pre-recorded lines with Voxtral TTS, from docs/redqueen-voicelines.md.
// Only new or changed lines are generated; pass --force to regenerate all.
// Files of lines that no longer exist in the script are removed.
// Usage: npm run voicelines [-- --force]
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { Mistral } from "@mistralai/mistralai";
import { LANGUAGES, type Language } from "../src/agent/config.js";
import { lineHash, TTS_MODEL, voiceFor } from "../src/audio/tts.js";
import { parseVoiceLines, SPEAKERS } from "../src/audio/voicelineScript.js";
import { repoRoot, requireEnv } from "../server/env.js";


const outDir = `${repoRoot}app/public/voicelines`;
const manifestPath = `${outDir}/manifest.json`;
const force = process.argv.includes("--force");

const script = readFileSync(`${repoRoot}docs/redqueen-voicelines.md`, "utf8");
const redQueenVoice = requireEnv("RED_QUEEN_VOICE_ID");
const client = new Mistral({ apiKey: requireEnv("MISTRAL_API_KEY") });

// Hash of model, voice and text per file, to detect changed lines.
const manifest: Record<string, string> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
let generated = 0;
const failed: string[] = [];

for (const language of LANGUAGES) {
  mkdirSync(`${outDir}/${language}`, { recursive: true });
  const current = new Set<string>();

  for (const speaker of SPEAKERS) {
    const voiceId = voiceFor(speaker, language, redQueenVoice);
    for (const { id, text } of parseVoiceLines(script, speaker, language)) {
      const file = `${language}/${id}.mp3`;
      current.add(`${id}.mp3`);
      const hash = await lineHash(voiceId, text);
      if (!force && manifest[file] === hash && existsSync(`${outDir}/${file}`)) continue;

      let response;
      try {
        response = await client.audio.speech.complete({ model: TTS_MODEL, voiceId, input: text, responseFormat: "mp3" });
      } catch (error) {
        // e.g. a line blocked by Mistral's moderation; keep going with the others
        const message = String((error as { body?: string }).body ?? error);
        failed.push(`${file}: ${message.includes("guardrail") ? "blocked by moderation, rephrase the line" : message}`);
        continue;
      }
      writeFileSync(`${outDir}/${file}`, Buffer.from(response.audioData, "base64"));
      manifest[file] = hash;
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      generated++;
      console.log(`generated ${file}`);
    }
  }

  for (const file of readdirSync(`${outDir}/${language}`)) {
    if (current.has(file)) continue;
    rmSync(`${outDir}/${language}/${file}`);
    delete manifest[`${language}/${file}`];
    console.log(`removed ${language}/${file}`);
  }
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(generated ? `${generated} line(s) generated` : "All lines up to date");
if (failed.length) {
  console.error(`\n${failed.length} line(s) failed:\n  ${failed.join("\n  ")}`);
  process.exitCode = 1;
}
