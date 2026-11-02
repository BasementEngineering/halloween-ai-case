import { LANGUAGES, type Language } from "../agent/config.js";

// Secrets on the phone. They are never part of the APK: `npm run phone:config` copies
// them from the repo's .env into the app's private files (files/config.json) over USB.
export interface DeviceConfig {
  mistralApiKey: string;
  agents: Record<Language, string>;
  clearanceCode: string;
}

export const DEVICE_CONFIG_FILE = "config.json";
export const SETUP_HINT = "not set up: run npm run phone:config";

export function parseDeviceConfig(raw: string): DeviceConfig {
  let config: Partial<DeviceConfig>;
  try {
    config = JSON.parse(raw);
  } catch {
    throw new Error(`config unreadable, ${SETUP_HINT}`);
  }
  const missing = [
    !config.mistralApiKey && "mistralApiKey",
    !config.clearanceCode && "clearanceCode",
    ...LANGUAGES.filter((language) => !config.agents?.[language]).map((language) => `agents.${language}`),
  ].filter(Boolean);
  if (missing.length) throw new Error(`config incomplete (${missing.join(", ")}), ${SETUP_HINT}`);
  return config as DeviceConfig;
}
