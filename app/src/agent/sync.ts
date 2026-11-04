import type { MistralCore } from "@mistralai/mistralai/core.js";
import { audioAgentsCreate } from "@mistralai/mistralai/funcs/audioAgentsCreate.js";
import { audioAgentsList } from "@mistralai/mistralai/funcs/audioAgentsList.js";
import { audioAgentsUpdate } from "@mistralai/mistralai/funcs/audioAgentsUpdate.js";
import { audioVoicesList } from "@mistralai/mistralai/funcs/audioVoicesList.js";
import { AGENTS, LANGUAGES, buildAgentConfiguration, extractSystemPrompt, type Language } from "./config.js";

// Creates or updates the Red Queen voice agents (one per language) in a Mistral account.
// Used by `npm run agent:sync` on the laptop and by the setup screen on the phone.
// Uses the SDK's standalone functions, which work in Node and in the browser build.

export type AgentIds = Record<Language, string>;

export async function syncAgents(
  client: MistralCore,
  persona: string,
  voiceId: string,
  log: (text: string) => void = () => {},
): Promise<AgentIds> {
  const ids = {} as AgentIds;
  for (const language of LANGUAGES) {
    const { name } = AGENTS[language];
    const request = {
      name,
      description: `Red Queen (${language}), security AI of the Resident Evil prop case`,
      configuration: buildAgentConfiguration({ language, instructions: extractSystemPrompt(persona, language), voiceId }),
    };
    const existing = await findAgent(client, name);
    const result = existing
      ? await audioAgentsUpdate(client, { agentId: existing, audioAgentUpdateRequest: request })
      : await audioAgentsCreate(client, request);
    if (!result.ok) throw result.error;
    ids[language] = result.value.id;
    log(`${existing ? "Updated" : "Created"} agent "${name}" (version ${result.value.version ?? "?"})`);
  }
  return ids;
}

async function findAgent(client: MistralCore, name: string): Promise<string | undefined> {
  for await (const page of await audioAgentsList(client, { search: name, pageSize: 50 })) {
    if (!page.ok) throw page.error;
    const match = page.value.result.data.find((agent) => agent.name === name);
    if (match) return match.id;
  }
  return undefined;
}

export interface VoiceOption {
  id: string;
  label: string;
  custom: boolean;
}

// The account's own voices first, then Mistral's presets.
export async function listVoices(client: MistralCore): Promise<VoiceOption[]> {
  const pageSize = 100; // the API's maximum
  const voices = [];
  for (let offset = 0; ; offset += pageSize) {
    const result = await audioVoicesList(client, { limit: pageSize, offset, type: "all" });
    if (!result.ok) throw result.error;
    voices.push(...result.value.items);
    if (result.value.items.length < pageSize || voices.length >= result.value.total) break;
  }
  return voices
    .map((voice) => ({
      id: voice.id,
      custom: voice.type !== "preset",
      label: [voice.name, voice.languages?.join("/"), voice.gender].filter(Boolean).join(", "),
    }))
    .sort((a, b) => Number(b.custom) - Number(a.custom) || a.label.localeCompare(b.label));
}
