// Text protocol between the app and the ESP32 in the case, over the Nordic UART Service.
// See firmware/README.md.

export const DEVICE_NAME = "RedQueenCase";
export const NUS_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
export const NUS_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // app -> ESP32
export const NUS_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // ESP32 -> app

// The ESP32 sends a heartbeat every 2 s; after this long without one the link counts as dead.
export const HEARTBEAT_TIMEOUT_MS = 5000;
export const PING_INTERVAL_MS = 3000;
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 10000];

export const DRAWER_STATES = ["UNKNOWN", "CLOSED", "OPENING", "OPEN", "CLOSING", "STUCK"] as const;
export type DrawerState = (typeof DRAWER_STATES)[number];
// The drawer's end switches: CLOSED ("drawer closed") and OPEN ("drawer open", optional).
export type EndSwitch = "CLOSED" | "OPEN";

export type CaseMessage =
  | { type: "heartbeat"; counter: number; uptimeSeconds: number }
  | { type: "vial"; inPlace: boolean }
  | { type: "pong" }
  | { type: "drawer"; state: DrawerState }
  | { type: "lid"; open: boolean }
  | { type: "mist"; on: boolean }
  | { type: "lights"; effect: string }
  | { type: "brightness"; value: number }
  | { type: "switch"; name: EndSwitch; pressed: boolean }
  | { type: "button"; name: string }
  | { type: "firmware"; version: string }
  | { type: "error"; text: string }
  | { type: "unknown"; line: string };

export function parseLine(raw: string): CaseMessage {
  const line = raw.trim();
  const heartbeat = line.match(/^HB:(\d+):(\d+)$/);
  if (heartbeat) return { type: "heartbeat", counter: Number(heartbeat[1]), uptimeSeconds: Number(heartbeat[2]) };
  if (line === "VIAL:0" || line === "VIAL:1") return { type: "vial", inPlace: line === "VIAL:1" };
  if (line === "PONG") return { type: "pong" };
  if (line === "LID:0" || line === "LID:1") return { type: "lid", open: line === "LID:1" };
  if (line === "MIST:ON" || line === "MIST:OFF") return { type: "mist", on: line === "MIST:ON" };
  const drawer = line.match(/^DRAWER:(\w+)$/);
  if (drawer && (DRAWER_STATES as readonly string[]).includes(drawer[1])) {
    return { type: "drawer", state: drawer[1] as DrawerState };
  }
  const endSwitch = line.match(/^SW:(CLOSED|OPEN):([01])$/);
  if (endSwitch) return { type: "switch", name: endSwitch[1] as EndSwitch, pressed: endSwitch[2] === "1" };
  const lights = line.match(/^LED:(\w+)$/);
  if (lights) return { type: "lights", effect: lights[1] };
  const brightness = line.match(/^BRIGHTNESS:(\d+)$/);
  if (brightness) return { type: "brightness", value: Number(brightness[1]) };
  if (line.startsWith("BTN:")) return { type: "button", name: line.slice(4) };
  if (line.startsWith("FW:")) return { type: "firmware", version: line.slice(3) };
  if (line.startsWith("ERR:")) return { type: "error", text: line.slice(4) };
  return { type: "unknown", line };
}

// Waits between reconnect attempts: 1, 2, 4, 8, then every 10 seconds.
export function reconnectDelay(attempt: number): number {
  return RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
}

export function isAlive(connected: boolean, lastHeartbeat: number | undefined, now: number): boolean {
  return connected && lastHeartbeat !== undefined && now - lastHeartbeat < HEARTBEAT_TIMEOUT_MS;
}
