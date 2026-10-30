// Creates or updates the Red Queen voice agents (one per language) on Mistral
// from the config in this repo.
// Usage: npm run agent:sync
import { readFileSync } from "node:fs";
import { Mistral } from "@mistralai/mistralai";
import { AGENTS, LANGUAGES, buildAgentConfiguration, extractSystemPrompt } from "../src/agent/config.js";
import { repoRoot, requireEnv, saveEnv } from "../server/env.js";

const persona = readFileSync(`${repoRoot}docs/redqueen-persona.md`, "utf8");
const voiceId = requireEnv("RED_QUEEN_VOICE_ID");
const client = new Mistral({ apiKey: requireEnv("MISTRAL_API_KEY") });

for (const language of LANGUAGES) {
  const { name, envVar } = AGENTS[language];
  const request = {
    name,
    description: `Red Queen (${language}), security AI of the Resident Evil prop case`,
    configuration: buildAgentConfiguration({
      language,
      instructions: extractSystemPrompt(persona, language),
      voiceId,
    }),
  };

  const existing = await findAgent(name);
  const agent = existing
    ? await client.audio.agents.update({ agentId: existing.id, audioAgentUpdateRequest: request })
    : await client.audio.agents.create(request);

  console.log(`${existing ? "Updated" : "Created"} agent "${name}" (id ${agent.id}, version ${agent.version ?? "?"})`);
  saveEnv(envVar, agent.id);
}

async function findAgent(name: string) {
  for await (const page of await client.audio.agents.list({ search: name, pageSize: 50 })) {
    const match = page.result.data.find((a) => a.name === name);
    if (match) return match;
  }
  return undefined;
}
