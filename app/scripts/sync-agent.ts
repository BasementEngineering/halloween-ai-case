// Creates or updates the Red Queen voice agents (one per language) on Mistral
// from the config in this repo. The phone's setup screen does the same (src/agent/sync.ts).
// Usage: npm run agent:sync
import { readFileSync } from "node:fs";
import { MistralCore } from "@mistralai/mistralai/core.js";
import { AGENTS, LANGUAGES } from "../src/agent/config.js";
import { syncAgents } from "../src/agent/sync.js";
import { repoRoot, requireEnv, saveEnv } from "../server/env.js";

const persona = readFileSync(`${repoRoot}docs/redqueen-persona.md`, "utf8");
const client = new MistralCore({ apiKey: requireEnv("MISTRAL_API_KEY") });

const ids = await syncAgents(client, persona, requireEnv("RED_QUEEN_VOICE_ID"), console.log);
for (const language of LANGUAGES) saveEnv(AGENTS[language].envVar, ids[language]);
