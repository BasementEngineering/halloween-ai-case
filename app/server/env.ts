import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Secrets live in the repo root .env (git-ignored), see .env.example.
export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
export const envPath = `${repoRoot}.env`;

export function requireEnv(name: string): string {
  // Re-read .env when a value is missing, e.g. an agent ID written by agent:sync
  // while the dev server was already running.
  if (!process.env[name]) process.loadEnvFile(envPath);
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing in ${envPath}`);
  return value;
}

export function saveEnv(name: string, value: string) {
  const env = readFileSync(envPath, "utf8");
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  writeFileSync(envPath, pattern.test(env) ? env.replace(pattern, line) : `${env.trimEnd()}\n${line}\n`);
  process.env[name] = value;
}
