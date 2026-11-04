import type { CaseLink } from "./caseLink.js";
import type { CaseMessage } from "./protocol.js";

// Hardware test mode: shows every sensor of the case and drives the drawer, the mist
// maker and the lights directly. The game ignores the vial while the panel is open.

const EFFECTS = ["IDLE", "COUNTDOWN", "ALERT", "ESCALATE", "GAME", "WIN", "FAIL", "OFF"] as const;
const ZONES = [
  ["INSIDE", "Inside (15)"],
  ["LOGO", "Logo (8)"],
  ["DRAWER", "Drawer (5)"],
] as const;
const LOG_LINES = 80;
// Sliders and colour pickers fire many events; send at most this often.
const SEND_INTERVAL_MS = 80;

type Tone = "good" | "warn" | "bad" | "";

export class HardwareTestPanel {
  private readonly root: HTMLElement;
  private readonly values = new Map<string, HTMLElement>();
  private readonly log: HTMLOListElement;
  private readonly brightness: HTMLInputElement;
  private readonly brightnessValue: HTMLElement;
  private readonly zoneColors = new Map<string, HTMLInputElement>();
  private readonly throttled = new Map<string, { timer?: number; line?: string; last: number }>();
  private lastHeartbeat?: number;
  private uptime?: number;
  private ageTimer?: number;
  private closeListener?: () => void;

  constructor(private readonly link: CaseLink) {
    this.root = document.createElement("section");
    this.root.id = "hwtest";
    this.root.hidden = true;
    this.root.innerHTML = `
      <header>
        <h2>Hardware test</h2>
        <button data-action="connect">Connect</button>
        <button data-action="refresh">Refresh</button>
        <button data-action="close">Close</button>
      </header>
      <div class="hwtest-grid">
        <div class="hwtest-card">
          <h3>Sensors</h3>
          <dl class="hwtest-state"></dl>
        </div>
        <div class="hwtest-card">
          <h3>Drawer</h3>
          <div class="hwtest-buttons">
            <button data-send="DRAWER:OPEN:DRY">Open</button>
            <button data-send="DRAWER:CLOSE">Close</button>
            <button data-send="DRAWER:STOP">Stop</button>
            <button data-send="DRAWER:OPEN" title="Like in the game: the drawer opens with 10 s of mist">Open + mist</button>
          </div>
          <h3>Mist</h3>
          <div class="hwtest-buttons">
            <button data-send="MIST:3">3 s</button>
            <button data-send="MIST:ON">10 s</button>
            <button data-send="MIST:30">30 s</button>
            <button data-send="MIST:OFF">Off</button>
          </div>
        </div>
        <div class="hwtest-card">
          <h3>Lights</h3>
          <div class="hwtest-buttons hwtest-effects">
            ${EFFECTS.map((effect) => `<button data-send="LED:${effect}">${effect}</button>`).join("")}
            <button data-send="LED:AUTO" title="Standalone lights: follow the vial like without the app">AUTO</button>
          </div>
          <label class="hwtest-slider">Brightness
            <input type="range" min="0" max="255" value="160" />
            <span>160</span>
          </label>
          <div class="hwtest-colors">
            ${ZONES.map(([zone, label]) => `<label>${label}<input type="color" data-zone="${zone}" value="#000000" /></label>`).join("")}
            <label>All<input type="color" data-zone="ALL" value="#000000" /></label>
          </div>
          <div class="hwtest-buttons">
            <button data-colors="FFFFFF">All white</button>
            <button data-colors="FF0000">All red</button>
            <button data-colors="00FF50">All green</button>
            <button data-colors="000000">All dark</button>
            <button data-send="LED:BRIGHTNESS">Default brightness</button>
          </div>
        </div>
        <div class="hwtest-card hwtest-log-card">
          <h3>Case log</h3>
          <ol class="hwtest-log"></ol>
          <form class="hwtest-command">
            <input placeholder="Command, e.g. STATUS or SIM:VIAL:0" autocomplete="off" />
            <button>Send</button>
          </form>
        </div>
      </div>`;
    document.body.append(this.root);

    const state = this.root.querySelector(".hwtest-state")!;
    for (const [key, label] of [
      ["link", "Link"],
      ["heartbeat", "Heartbeat"],
      ["firmware", "Firmware"],
      ["vial", "Vial"],
      ["lid", "Lid"],
      ["drawer", "Drawer"],
      ["switch-CLOSED", "Switch drawer closed"],
      ["switch-OPEN", "Switch drawer open"],
      ["mist", "Mist"],
      ["button", "Override button"],
      ["lights", "Light effect"],
    ]) {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = "–";
      state.append(dt, dd);
      this.values.set(key, dd);
    }

    this.log = this.root.querySelector(".hwtest-log")!;
    this.brightness = this.root.querySelector(".hwtest-slider input")!;
    this.brightnessValue = this.root.querySelector(".hwtest-slider span")!;
    for (const input of this.root.querySelectorAll<HTMLInputElement>("input[data-zone]")) {
      this.zoneColors.set(input.dataset.zone!, input);
      input.addEventListener("input", () => this.setColor(input.dataset.zone!, input.value));
    }

    this.root.addEventListener("click", (e) => {
      const button = (e.target as HTMLElement).closest("button");
      if (!button) return;
      if (button.dataset.send) this.send(button.dataset.send);
      if (button.dataset.colors) this.setColor("ALL", `#${button.dataset.colors}`);
      if (button.dataset.action === "connect") this.link.pick();
      if (button.dataset.action === "refresh") this.send("STATUS");
      if (button.dataset.action === "close") this.closeListener?.();
    });
    this.brightness.addEventListener("input", () => {
      this.brightnessValue.textContent = this.brightness.value;
      this.sendThrottled("brightness", `LED:BRIGHTNESS:${this.brightness.value}`);
    });
    this.root.querySelector("form")!.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = this.root.querySelector<HTMLInputElement>(".hwtest-command input")!;
      if (input.value.trim()) this.send(input.value.trim().toUpperCase());
      input.value = "";
    });

    link.onStatus(() => this.renderLink());
    link.onLog((text) => this.addLog(text, "info"));
    link.onMessage((message) => this.receive(message));
    this.renderLink();
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  onClose(listener: () => void) {
    this.closeListener = listener;
  }

  open() {
    this.root.hidden = false;
    this.send("STATUS");
    window.clearInterval(this.ageTimer);
    this.ageTimer = window.setInterval(() => this.renderHeartbeat(), 500);
  }

  close() {
    this.root.hidden = true;
    window.clearInterval(this.ageTimer);
  }

  private receive(message: CaseMessage) {
    switch (message.type) {
      case "heartbeat":
        this.lastHeartbeat = performance.now();
        this.uptime = message.uptimeSeconds;
        this.renderHeartbeat();
        return; // too frequent for the log
      case "pong":
        return;
      case "vial":
        this.show("vial", message.inPlace ? "IN PLACE" : "REMOVED", message.inPlace ? "good" : "warn");
        break;
      case "lid":
        this.show("lid", message.open ? "OPEN" : "CLOSED");
        break;
      case "drawer": {
        const tone = message.state === "STUCK" ? "bad" : message.state.endsWith("ING") ? "warn" : "";
        this.show("drawer", message.state, tone);
        break;
      }
      case "switch":
        this.show(`switch-${message.name}`, message.pressed ? "PRESSED" : "released", message.pressed ? "good" : "");
        break;
      case "mist":
        this.show("mist", message.on ? "ON" : "OFF", message.on ? "warn" : "");
        break;
      case "button":
        this.show("button", `pressed ${new Date().toLocaleTimeString()}`, "warn");
        break;
      case "lights":
        this.show("lights", message.effect);
        break;
      case "brightness":
        this.brightness.value = String(message.value);
        this.brightnessValue.textContent = String(message.value);
        break;
      case "firmware":
        this.show("firmware", message.version);
        break;
    }
    const line = message.type === "unknown" ? message.line : this.describe(message);
    this.addLog(`← ${line}`, message.type === "error" ? "error" : "");
  }

  private describe(message: CaseMessage): string {
    switch (message.type) {
      case "vial": return `VIAL:${message.inPlace ? 1 : 0}`;
      case "lid": return `LID:${message.open ? 1 : 0}`;
      case "drawer": return `DRAWER:${message.state}`;
      case "switch": return `SW:${message.name}:${message.pressed ? 1 : 0}`;
      case "mist": return `MIST:${message.on ? "ON" : "OFF"}`;
      case "button": return `BTN:${message.name}`;
      case "lights": return `LED:${message.effect}`;
      case "brightness": return `BRIGHTNESS:${message.value}`;
      case "firmware": return `FW:${message.version}`;
      case "error": return `ERR:${message.text}`;
      default: return message.type;
    }
  }

  private setColor(zone: string, color: string) {
    const targets = zone === "ALL" ? [...this.zoneColors.values()] : [this.zoneColors.get(zone)!];
    for (const input of targets) input.value = color;
    this.sendThrottled(`color-${zone}`, `LED:COLOR:${zone}:${color.slice(1).toUpperCase()}`);
  }

  private send(line: string) {
    if (this.link.status !== "connected") {
      this.addLog(`not connected, not sent: ${line}`, "error");
      return;
    }
    this.addLog(`→ ${line}`, "sent");
    this.link.send(line).catch((error) => this.addLog(`sending ${line} failed: ${error}`, "error"));
  }

  // Sends the newest value at most every SEND_INTERVAL_MS, and always the last one.
  private sendThrottled(key: string, line: string) {
    const entry = this.throttled.get(key) ?? { last: 0 };
    this.throttled.set(key, entry);
    entry.line = line;
    if (entry.timer !== undefined) return;
    const wait = Math.max(0, entry.last + SEND_INTERVAL_MS - performance.now());
    entry.timer = window.setTimeout(() => {
      entry.timer = undefined;
      entry.last = performance.now();
      if (entry.line) this.send(entry.line);
    }, wait);
  }

  private show(key: string, text: string, tone: Tone = "") {
    const element = this.values.get(key);
    if (!element) return;
    element.textContent = text;
    element.className = tone;
  }

  private renderLink() {
    const status = this.link.status;
    this.show("link", status, status === "connected" ? "good" : status === "connecting" ? "warn" : "bad");
    this.root.querySelector<HTMLButtonElement>("[data-action=connect]")!.hidden = status === "connected";
    this.renderHeartbeat();
  }

  private renderHeartbeat() {
    if (this.lastHeartbeat === undefined) {
      this.show("heartbeat", "none yet", "bad");
      return;
    }
    const age = (performance.now() - this.lastHeartbeat) / 1000;
    this.show("heartbeat", `${age.toFixed(1)} s ago, up ${this.uptime} s`, this.link.alive ? "good" : "bad");
  }

  private addLog(text: string, kind: string) {
    const item = document.createElement("li");
    item.textContent = `${new Date().toLocaleTimeString()}  ${text}`;
    item.className = kind;
    this.log.prepend(item);
    while (this.log.children.length > LOG_LINES) this.log.lastElementChild!.remove();
  }
}
