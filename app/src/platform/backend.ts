import type { AudioSessionCreateResponse } from "@mistralai/mistralai/models/components";
import type { initSession } from "@mistralai/mistralai/extra/voice-agents/browser";
import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import type { Language } from "../agent/config.js";
import { codesMatch } from "../game/code.js";
import { DEVICE_CONFIG_FILE, parseDeviceConfig, SETUP_HINT, SetupRequiredError, type DeviceConfig } from "./deviceConfig.js";

type SessionTools = Parameters<Parameters<typeof initSession>[0]["createSession"]>[0];

// What the game needs from outside: voice sessions and the clearance code check.
export interface Backend {
  createVoiceSession(tools: SessionTools, language: Language): Promise<AudioSessionCreateResponse>;
  closeVoiceSession(sessionId: string): Promise<void>;
  verifyCode(code: string): Promise<boolean>;
}

// Laptop: the Vite dev server holds the key (server/api.ts).
// Phone app: the key comes from the app-private config file (see deviceConfig.ts).
export function createBackend(): Promise<Backend> {
  return Capacitor.isNativePlatform() ? createDeviceBackend() : Promise.resolve(devServerBackend);
}

const devServerBackend: Backend = {
  async createVoiceSession(tools, language) {
    const raw = await postJson<any>("/api/voice-session", { tools, language });
    return { ...raw, createdAt: new Date(raw.createdAt), expiresAt: new Date(raw.expiresAt) } as AudioSessionCreateResponse;
  },
  async closeVoiceSession(sessionId) {
    await fetch(`/api/voice-session?sessionId=${encodeURIComponent(sessionId)}`, { method: "DELETE" });
  },
  async verifyCode(code) {
    const { valid } = await postJson<{ valid: boolean }>("/api/verify-code", { code });
    return valid;
  },
};

async function createDeviceBackend(): Promise<Backend> {
  const config = await loadDeviceConfig();
  // The SDK's standalone functions: the full client also pulls in the Node-only parts
  // of the voice agents, which break the browser build.
  const [{ MistralCore }, { audioSessionsCreate }, { audioSessionsClose }] = await Promise.all([
    import("@mistralai/mistralai/core.js"),
    import("@mistralai/mistralai/funcs/audioSessionsCreate.js"),
    import("@mistralai/mistralai/funcs/audioSessionsClose.js"),
  ]);
  const client = new MistralCore({ apiKey: config.mistralApiKey });
  return {
    async createVoiceSession(tools, language) {
      // Same request the dev server sends; the tool declarations come from the SDK itself.
      const result = await audioSessionsCreate(client, { agentId: config.agents[language], tools: tools as never });
      if (!result.ok) throw result.error;
      return result.value;
    },
    async closeVoiceSession(sessionId) {
      const result = await audioSessionsClose(client, { sessionId });
      if (!result.ok) throw result.error;
    },
    async verifyCode(code) {
      return codesMatch(code, config.clearanceCode);
    },
  };
}

async function loadDeviceConfig(): Promise<DeviceConfig> {
  const raw = await readDeviceConfigFile();
  if (raw === undefined) throw new SetupRequiredError(SETUP_HINT);
  return parseDeviceConfig(raw);
}

async function readDeviceConfigFile(): Promise<string | undefined> {
  try {
    const file = await Filesystem.readFile({ path: DEVICE_CONFIG_FILE, directory: Directory.Data, encoding: Encoding.UTF8 });
    return String(file.data);
  } catch {
    return undefined;
  }
}

// What the setup screen can prefill: whatever is saved, even if incomplete.
export async function readSavedConfig(): Promise<Partial<DeviceConfig>> {
  try {
    return JSON.parse((await readDeviceConfigFile()) ?? "{}");
  } catch {
    return {};
  }
}

// Writes the config into the app's private files (only this app can read them).
export async function saveDeviceConfig(config: DeviceConfig) {
  await Filesystem.writeFile({
    path: DEVICE_CONFIG_FILE,
    directory: Directory.Data,
    encoding: Encoding.UTF8,
    data: JSON.stringify(config),
  });
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${url}: ${response.status} ${await response.text()}`);
  return response.json() as Promise<T>;
}
