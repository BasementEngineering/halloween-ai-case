// Text protocol between the app and the ESP32 in the case, over the Nordic UART Service.
// See firmware/esp32-ble-test/esp32-ble-test.ino.

export const DEVICE_NAME = "RedQueenCase";
export const NUS_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
export const NUS_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // app -> ESP32
export const NUS_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // ESP32 -> app

// The ESP32 sends a heartbeat every 2 s; after this long without one the link counts as dead.
export const HEARTBEAT_TIMEOUT_MS = 5000;
export const PING_INTERVAL_MS = 3000;
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 10000];

export type CaseMessage =
  | { type: "heartbeat"; counter: number; uptimeSeconds: number }
  | { type: "vial"; inPlace: boolean }
  | { type: "pong" }
  | { type: "unknown"; line: string };

export function parseLine(raw: string): CaseMessage {
  const line = raw.trim();
  const heartbeat = line.match(/^HB:(\d+):(\d+)$/);
  if (heartbeat) return { type: "heartbeat", counter: Number(heartbeat[1]), uptimeSeconds: Number(heartbeat[2]) };
  if (line === "VIAL:0" || line === "VIAL:1") return { type: "vial", inPlace: line === "VIAL:1" };
  if (line === "PONG") return { type: "pong" };
  return { type: "unknown", line };
}

// Waits between reconnect attempts: 1, 2, 4, 8, then every 10 seconds.
export function reconnectDelay(attempt: number): number {
  return RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
}

export function isAlive(connected: boolean, lastHeartbeat: number | undefined, now: number): boolean {
  return connected && lastHeartbeat !== undefined && now - lastHeartbeat < HEARTBEAT_TIMEOUT_MS;
}
