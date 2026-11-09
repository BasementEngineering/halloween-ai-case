import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { env, run } from "./android.js";

// Builds the APK that can be handed out or attached to a GitHub release.
//   npm run release
// It contains no Red Queen voice lines, no voice line manifest and no own standby logo:
// the player enters their own Mistral key in the setup screen, which creates the agents
// and generates her lines on the phone. The finished APK is checked for those files and
// for the values in .env before it is copied to release/.

// Git-ignored files in public/ that Vite would otherwise copy into the build.
const PRIVATE = [/^voicelines\/[^/]+\/RQ_[^/]*\.mp3$/, /^voicelines\/manifest\.json$/, /^standby\/logo\.png$/];
const isPrivate = (path: string) => PRIVATE.some((pattern) => pattern.test(path));

const androidDir = resolve("android");
const gradlew = resolve(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");
const versionName = /versionName\s+"([^"]+)"/.exec(readFileSync("android/app/build.gradle", "utf8"))?.[1] ?? "dev";

run("npx", ["vite", "build"]);
for (const file of listFiles("dist")) if (isPrivate(file)) rmSync(join("dist", file));
run("npx", ["cap", "sync", "android"]);
run(gradlew, ["assembleRelease"], { cwd: androidDir });

const outDir = "android/app/build/outputs/apk/release";
const signed = join(outDir, "app-release.apk");
if (!existsSync(signed)) {
  throw new Error(`no signed APK in ${outDir}: create the signing key first, see docs/phone-setup.md (Release APK)`);
}

// Check the finished APK, not just dist/.
const unpacked = mkdtempSync(join(tmpdir(), "redqueen-apk-"));
try {
  run(join(env.JAVA_HOME, "bin", "jar"), ["xf", resolve(signed)], { cwd: unpacked, shell: false });
  const files = listFiles(unpacked);
  const assets = files.filter((f) => f.startsWith("assets/public/")).map((f) => f.slice("assets/public/".length));
  const leaked = assets.filter(isPrivate);
  if (leaked.length) throw new Error(`private files in the APK:\n  ${leaked.join("\n  ")}`);

  // Values that are in the public source anyway (like the placeholder code) don't count.
  const source = listFiles("src").map((f) => readFileSync(join("src", f), "utf8")).join("\n");
  const secrets = envValues("../.env").filter(([, value]) => !source.includes(value));
  const hits = new Set<string>();
  for (const file of files) {
    const content = readFileSync(join(unpacked, file)).toString("latin1");
    for (const [name, value] of secrets) if (content.includes(value)) hits.add(`${name} in ${file}`);
  }
  if (hits.size) throw new Error(`values from .env found in the APK:\n  ${[...hits].join("\n  ")}`);
  console.log(`Checked ${files.length} files: no private assets, none of the ${secrets.length} .env values.`);
} finally {
  rmSync(unpacked, { recursive: true, force: true });
}

verifySignature(signed);
mkdirSync("../release", { recursive: true });
const target = `../release/red-queen-case-${versionName}.apk`;
copyFileSync(signed, target);
console.log(`Release APK: ${resolve(target)}`);

function listFiles(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path, root) : [relative(root, path).replaceAll("\\", "/")];
  });
}

// Values from .env that must never end up in the APK (only names are ever printed).
function envValues(path: string): [string, string][] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => /^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*?)"?\s*$/.exec(line))
    .filter((m): m is RegExpExecArray => m !== null && m[2].length >= 8)
    .map((m) => [m[1], m[2]]);
}

function verifySignature(apk: string) {
  const buildTools = join(env.ANDROID_HOME, "build-tools");
  const latest = readdirSync(buildTools).sort().at(-1);
  if (!latest) throw new Error(`no build-tools in ${buildTools}`);
  const apksigner = join(buildTools, latest, process.platform === "win32" ? "apksigner.bat" : "apksigner");
  const result = spawnSync(apksigner, ["verify", "--print-certs", apk], { encoding: "utf8", env, shell: process.platform === "win32" });
  if (result.status !== 0) throw new Error(`apksigner verify failed:\n${result.stdout}${result.stderr}`);
  console.log(result.stdout.split("\n").find((line) => line.includes("certificate DN")) ?? "Signature verified.");
}
