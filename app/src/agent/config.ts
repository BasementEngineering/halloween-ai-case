import { toAudioTool } from "@mistralai/mistralai/extra/voice-agents/tools.js";
import type { AudioAgentConfigurationRequest } from "@mistralai/mistralai/models/components";
import { GAME_RULES } from "../game/rules.js";
import { createRedQueenTools } from "./tools.js";

// Agent configuration, see docs/mistral-setup.md#3-agent-configuration

export type Language = "en" | "de";
export const LANGUAGES: Language[] = ["en", "de"];

// One agent per language, each with its own prompt and speech recognition.
export const AGENTS: Record<Language, { name: string; promptHeading: string; envVar: string; contextBias: string[] }> = {
  en: {
    name: "red-queen",
    promptHeading: "## System prompt",
    envVar: "RED_QUEEN_AGENT_ID",
    contextBias: ["Red Queen", "antidote", "clearance", "clearance code", "Umbrella", "T-virus", "vial"],
  },
  de: {
    name: "red-queen-de",
    promptHeading: "## System prompt (German)",
    envVar: "RED_QUEEN_AGENT_ID_DE",
    contextBias: ["Red Queen", "Gegengift", "Freigabecode", "Freigabe", "Umbrella", "T-Virus", "Ampulle"],
  },
};

// Pulls the system prompt out of the first code block under the language's heading
// in docs/redqueen-persona.md and fills in the game values.
export function extractSystemPrompt(personaMarkdown: string, language: Language): string {
  personaMarkdown = personaMarkdown.replace(/\r\n/g, "\n"); // Windows checkouts (core.autocrlf)
  const heading = AGENTS[language].promptHeading.replace(/[()]/g, "\\$&");
  const section = personaMarkdown.split(new RegExp(`^${heading}\\s*$`, "m"))[1];
  const block = section?.match(/```[^\n]*\n([\s\S]*?)\n```/);
  if (!block) throw new Error(`No system prompt code block found under "${AGENTS[language].promptHeading}"`);
  return block[1].replaceAll("{{time_limit}}", String(GAME_RULES.timeLimitSeconds));
}

export function buildAgentConfiguration(opts: {
  language: Language;
  instructions: string;
  voiceId: string;
}): AudioAgentConfigurationRequest {
  // Only the declarations are saved on the agent, so the handlers are stubs here.
  const tools = createRedQueenTools({
    setTrust: () => ({ trust: 0, seconds_left: 0, antidote_released: false }),
    verifyClearanceCode: () => ({ valid: false, attempts_left: 0 }),
    registerName: (name) => ({ name }),
  });

  return {
    llm: { model: "mistral-small-latest" },
    stt: {
      model: "voxtral-mini-transcribe-realtime-3",
      language: opts.language,
      contextBias: AGENTS[opts.language].contextBias,
      turnDetection: { startThreshold: 0.65 },
    },
    tts: { model: "voxtral-mini-tts-3", voiceId: opts.voiceId },
    turn: { allowInterruptions: true },
    instructions: opts.instructions,
    welcomeMessage: null,
    tools: tools.map(toAudioTool),
  };
}
