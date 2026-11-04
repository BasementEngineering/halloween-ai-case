import { AGENTS, LANGUAGES } from "../src/agent/config.js";
import type { DeviceConfig } from "../src/platform/deviceConfig.js";
import { DEVICE_CONFIG_FILE } from "../src/platform/deviceConfig.js";
import { requireEnv } from "../server/env.js";
import { adb, APP_ID, requirePhone } from "./android.js";

// Copies the key, agent IDs and clearance code from .env into the app's private files
// on the phone, over USB. Nothing is written to a shared folder, and the values are
// never printed. Needs the debug build installed (npm run phone).
//   npm run phone:config
requirePhone();

const config: DeviceConfig = {
  mistralApiKey: requireEnv("MISTRAL_API_KEY"),
  agents: Object.fromEntries(LANGUAGES.map((language) => [language, requireEnv(AGENTS[language].envVar)])) as DeviceConfig["agents"],
  clearanceCode: requireEnv("RED_QUEEN_CLEARANCE_CODE"),
  voiceId: requireEnv("RED_QUEEN_VOICE_ID"),
};

// run-as gives a shell as the app (debug builds only); the file arrives through stdin.
adb(["exec-in", "run-as", APP_ID, "sh", "-c", `mkdir -p files && umask 077 && cat > files/${DEVICE_CONFIG_FILE} && chmod 600 files/${DEVICE_CONFIG_FILE}`], {
  input: JSON.stringify(config),
  stdio: ["pipe", "inherit", "inherit"],
});
adb(["shell", "am", "force-stop", APP_ID]);
adb(["shell", "am", "start", "-n", `${APP_ID}/.MainActivity`]);
console.log(`Config copied (languages: ${LANGUAGES.join(", ")}). App restarted.`);
