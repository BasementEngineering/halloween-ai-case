import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Shared helpers for the phone scripts: finds the Android SDK and the JDK that comes
// with Android Studio, so nothing has to be on the PATH.
export const APP_ID = "de.redqueencase.app";

const androidHome =
  process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk");
const javaHome = process.env.JAVA_HOME ?? "C:\\Program Files\\Android\\Android Studio\\jbr";

export const env = { ...process.env, ANDROID_HOME: androidHome, JAVA_HOME: javaHome };
export const adbPath = join(androidHome, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");

if (!existsSync(adbPath)) throw new Error(`adb not found at ${adbPath}; set ANDROID_HOME`);

// Runs a command and stops the script if it fails.
export function run(command: string, args: string[], options: SpawnSyncOptions = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", env, shell: process.platform === "win32", ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed (exit ${result.status})`);
  return result;
}

export function adb(args: string[], options: SpawnSyncOptions = {}) {
  return run(adbPath, args, { shell: false, ...options });
}

// Exactly one phone must be connected and allowed for USB debugging.
export function requirePhone() {
  const result = spawnSync(adbPath, ["devices"], { encoding: "utf8" });
  const devices = result.stdout
    .split("\n")
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial]) => serial);
  const ready = devices.filter(([, state]) => state === "device");
  if (devices.some(([, state]) => state === "unauthorized")) {
    throw new Error("phone connected but not authorized: confirm the USB debugging prompt on the phone");
  }
  if (ready.length !== 1) throw new Error(`expected one phone, found ${ready.length}`);
}
