import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import type { MistralCore } from "@mistralai/mistralai/core.js";
import script from "../../../docs/redqueen-voicelines.md?raw";
import { LANGUAGES } from "../agent/config.js";
import { lineHash, TTS_MODEL, voiceFor } from "./tts.js";
import { parseVoiceLines, SPEAKERS, type Speaker } from "./voicelineScript.js";

// Voice lines generated on the phone with the player's own Mistral account, stored in the
// app's private files (voicelines/<language>/<ID>.mp3). The APK ships no Red Queen lines;
// the case computer's lines are bundled as a fallback.

const DIR = "voicelines";
const MANIFEST = `${DIR}/manifest.json`;

type Manifest = Record<string, string>;
interface PlannedLine {
  file: string;
  speaker: Speaker;
  voiceId: string;
  text: string;
}

export interface GenerateResult {
  generated: number;
  failed: string[];
}

// URL the player can load the generated files from (same origin as the app).
export async function generatedVoiceLineBase(): Promise<string> {
  const { uri } = await Filesystem.getUri({ directory: Directory.Data, path: DIR });
  return Capacitor.convertFileSrc(uri).replace(/\/+$/, "");
}

// Red Queen lines that are missing or were made with another voice or text.
// Her lines have no fallback, so the game needs all of them.
export async function missingRedQueenLines(voiceId: string): Promise<number> {
  const manifest = await readManifest();
  let missing = 0;
  for (const line of plan(voiceId)) {
    if (line.speaker === "redqueen" && manifest[line.file] !== (await lineHash(line.voiceId, line.text))) missing++;
  }
  return missing;
}

// Generates every line that is missing or changed (or all of them with `force`).
export async function generateVoiceLines(
  client: MistralCore,
  voiceId: string,
  options: { force?: boolean; onProgress?: (done: number, total: number, file: string) => void } = {},
): Promise<GenerateResult> {
  const { audioSpeechComplete } = await import("@mistralai/mistralai/funcs/audioSpeechComplete.js");
  const manifest = await readManifest();
  const todo = [];
  for (const line of plan(voiceId)) {
    const hash = await lineHash(line.voiceId, line.text);
    if (options.force || manifest[line.file] !== hash) todo.push({ ...line, hash });
  }

  const failed: string[] = [];
  let generated = 0;
  for (const [index, line] of todo.entries()) {
    options.onProgress?.(index, todo.length, line.file);
    const result = await audioSpeechComplete(client, {
      model: TTS_MODEL,
      voiceId: line.voiceId,
      input: line.text,
      responseFormat: "mp3",
    });
    if (!result.ok) {
      // e.g. a line blocked by Mistral's moderation; carry on with the others
      const message = String((result.error as { body?: string }).body ?? result.error);
      failed.push(`${line.file}: ${message.includes("guardrail") ? "blocked by moderation" : message.slice(0, 160)}`);
      continue;
    }
    // The API returns base64, which is what Filesystem writes as binary.
    await Filesystem.writeFile({ path: `${DIR}/${line.file}`, directory: Directory.Data, data: result.value.audioData, recursive: true });
    manifest[line.file] = line.hash;
    await writeManifest(manifest);
    generated++;
  }
  options.onProgress?.(todo.length, todo.length, "");
  return { generated, failed };
}

function plan(redQueenVoice: string): PlannedLine[] {
  return LANGUAGES.flatMap((language) =>
    SPEAKERS.flatMap((speaker) =>
      parseVoiceLines(script, speaker, language).map(({ id, text }) => ({
        file: `${language}/${id}.mp3`,
        speaker,
        voiceId: voiceFor(speaker, language, redQueenVoice),
        text,
      })),
    ),
  );
}

async function readManifest(): Promise<Manifest> {
  try {
    const file = await Filesystem.readFile({ path: MANIFEST, directory: Directory.Data, encoding: Encoding.UTF8 });
    return JSON.parse(String(file.data));
  } catch {
    return {};
  }
}

async function writeManifest(manifest: Manifest) {
  await Filesystem.writeFile({
    path: MANIFEST,
    directory: Directory.Data,
    encoding: Encoding.UTF8,
    data: JSON.stringify(manifest),
    recursive: true,
  });
}
