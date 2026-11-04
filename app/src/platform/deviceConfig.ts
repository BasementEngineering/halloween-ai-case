import { LANGUAGES, type Language } from "../agent/config.js";

// Secrets on the phone. They are never part of the APK: the setup screen writes them into
// the app's private files (files/config.json), or `npm run phone:config` copies them from
// the repo's .env over USB.
export interface DeviceConfig {
  mistralApiKey: string;
  agents: Record<Language, string>;
  clearanceCode: string;
  // The voice the setup screen created the agents with, to preselect it next time.
  voiceId?: string;
}

export const DEVICE_CONFIG_FILE = "config.json";
export const SETUP_HINT = "not set up: open the setup screen";

// Thrown when the config is missing or incomplete, so the app can open the setup screen.
export class SetupRequiredError extends Error {}

export function parseDeviceConfig(raw: string): DeviceConfig {
  let config: Partial<DeviceConfig>;
  try {
    config = JSON.parse(raw);
  } catch {
    throw new SetupRequiredError(`config unreadable, ${SETUP_HINT}`);
  }
  const missing = [
    !config.mistralApiKey && "mistralApiKey",
    !config.clearanceCode && "clearanceCode",
    ...LANGUAGES.filter((language) => !config.agents?.[language]).map((language) => `agents.${language}`),
  ].filter(Boolean);
  if (missing.length) throw new SetupRequiredError(`config incomplete (${missing.join(", ")}), ${SETUP_HINT}`);
  return config as DeviceConfig;
}
