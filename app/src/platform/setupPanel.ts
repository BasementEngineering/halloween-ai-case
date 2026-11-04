import { MistralCore } from "@mistralai/mistralai/core.js";
import persona from "../../../docs/redqueen-persona.md?raw";
import { listVoices, syncAgents } from "../agent/sync.js";
import { looksLikeCode } from "../game/code.js";
import { readSavedConfig, saveDeviceConfig } from "./backend.js";
import type { DeviceConfig } from "./deviceConfig.js";

// Setup screen on the phone: the player's own Mistral API key, the voice and the clearance
// code. Saving creates (or updates) the two Red Queen agents in that Mistral account and
// writes everything into the app's private files. Nothing leaves the phone except the
// requests to Mistral.

export class SetupPanel {
  private readonly root: HTMLElement;
  private readonly key: HTMLInputElement;
  private readonly code: HTMLInputElement;
  private readonly voice: HTMLSelectElement;
  private readonly log: HTMLOListElement;
  private readonly buttons: HTMLButtonElement[];
  private saved: Partial<DeviceConfig> = {};
  private closeListener?: () => void;

  constructor() {
    this.root = document.createElement("section");
    this.root.id = "setup";
    this.root.hidden = true;
    this.root.innerHTML = `
      <header>
        <h2>Setup</h2>
        <button data-action="close">Close</button>
      </header>
      <p class="setup-intro">
        The Red Queen runs on a Mistral voice agent in your own Mistral account. Get an API key at
        console.mistral.ai, choose her voice and the clearance code printed for your players.
        Saving creates the agents "red-queen" and "red-queen-de" in that account (or updates them).
      </p>
      <label>Mistral API key
        <input name="key" type="password" autocomplete="off" spellcheck="false">
      </label>
      <label>Voice
        <span class="setup-row">
          <select name="voice"></select>
          <button data-action="voices">Load voices</button>
        </span>
      </label>
      <label>Clearance code
        <input name="code" autocomplete="off" spellcheck="false" placeholder="e.g. ALPHA-77">
        <small>Letters and at least one digit, so it can be told apart from names and sentences.</small>
      </label>
      <div class="setup-row">
        <button data-action="save" class="primary">Save and set up agents</button>
      </div>
      <ol class="setup-log"></ol>
    `;
    document.body.append(this.root);
    this.key = this.root.querySelector("input[name=key]")!;
    this.code = this.root.querySelector("input[name=code]")!;
    this.voice = this.root.querySelector("select[name=voice]")!;
    this.log = this.root.querySelector(".setup-log")!;
    this.buttons = [...this.root.querySelectorAll<HTMLButtonElement>("button")];

    this.root.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
      if (!button) return;
      if (button.dataset.action === "close") this.closeListener?.();
      if (button.dataset.action === "voices") this.run(() => this.loadVoices());
      if (button.dataset.action === "save") this.run(() => this.save());
    });
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  onClose(listener: () => void) {
    this.closeListener = listener;
  }

  async open(reason?: string) {
    this.saved = await readSavedConfig();
    this.key.value = "";
    this.key.placeholder = this.saved.mistralApiKey ? "saved – leave empty to keep it" : "paste your key";
    this.code.value = this.saved.clearanceCode ?? "";
    this.voice.replaceChildren(
      this.saved.voiceId
        ? new Option(`current voice (${this.saved.voiceId.slice(0, 8)}…)`, this.saved.voiceId)
        : new Option("load the voices first", ""),
    );
    this.log.replaceChildren();
    if (reason) this.addLog(reason, "warn");
    this.root.hidden = false;
  }

  close() {
    this.root.hidden = true;
  }

  private client(): MistralCore {
    const apiKey = this.key.value.trim() || this.saved.mistralApiKey;
    if (!apiKey) throw new Error("Enter your Mistral API key first.");
    return new MistralCore({ apiKey });
  }

  private async loadVoices() {
    this.addLog("Loading voices…");
    const voices = await listVoices(this.client());
    const selected = this.voice.value;
    const group = (label: string, custom: boolean) => {
      const element = document.createElement("optgroup");
      element.label = label;
      element.append(...voices.filter((v) => v.custom === custom).map((v) => new Option(v.label, v.id)));
      return element;
    };
    this.voice.replaceChildren(group("Your voices", true), group("Mistral presets", false));
    if (selected && voices.some((v) => v.id === selected)) this.voice.value = selected;
    this.addLog(`${voices.length} voices. Pick one with a calm, cold delivery; she speaks English and German.`, "good");
  }

  private async save() {
    const client = this.client();
    const clearanceCode = this.code.value.trim();
    const voiceId = this.voice.value;
    if (!looksLikeCode(clearanceCode)) throw new Error("The clearance code needs at least one digit and at most 16 characters.");
    if (!voiceId) throw new Error("Load the voices and pick one first.");

    this.addLog("Setting up the agents…");
    const agents = await syncAgents(client, persona, voiceId, (text) => this.addLog(text));
    await saveDeviceConfig({
      mistralApiKey: this.key.value.trim() || this.saved.mistralApiKey!,
      agents,
      clearanceCode,
      voiceId,
    });
    this.addLog("Saved. Restarting the app…", "good");
    window.setTimeout(() => location.reload(), 1500);
  }

  // Runs one action with the buttons locked, and shows errors in the log.
  private async run(action: () => Promise<void>) {
    for (const button of this.buttons) button.disabled = true;
    try {
      await action();
    } catch (error) {
      this.addLog(describeError(error), "bad");
    } finally {
      for (const button of this.buttons) button.disabled = false;
    }
  }

  private addLog(text: string, tone: "good" | "warn" | "bad" | "" = "") {
    const item = document.createElement("li");
    item.className = tone;
    item.textContent = text;
    this.log.append(item);
    item.scrollIntoView({ block: "nearest" });
  }
}

function describeError(error: unknown): string {
  const status = (error as { statusCode?: number }).statusCode;
  if (status === 401) return "Mistral rejected the API key (401). Check that it is complete and active.";
  if (status === 403) return "This API key may not use voice agents (403). Check your Mistral plan.";
  return String((error as Error).message ?? error);
}
