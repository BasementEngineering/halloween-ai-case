import { resolve } from "node:path";
import { adb, APP_ID, requirePhone, run } from "./android.js";

// Builds the app, installs it on the connected phone and starts it.
//   npm run phone
// The secrets are not part of the app; copy them once with `npm run phone:config`.
requirePhone();
run("npx", ["vite", "build"]);
run("npx", ["cap", "sync", "android"]);
const androidDir = resolve("android");
run(resolve(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew"), ["assembleDebug"], { cwd: androidDir });
adb(["install", "-r", "android/app/build/outputs/apk/debug/app-debug.apk"]);
adb(["shell", "am", "start", "-n", `${APP_ID}/.MainActivity`]);
console.log("Started. Debug the WebView from chrome://inspect on the laptop.");
