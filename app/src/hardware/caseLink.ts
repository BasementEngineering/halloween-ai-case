/// <reference types="web-bluetooth" />
import { BleClient } from "@capacitor-community/bluetooth-le";
import { Capacitor } from "@capacitor/core";
import {
  DEVICE_NAME,
  isAlive,
  NUS_RX,
  NUS_SERVICE,
  NUS_TX,
  parseLine,
  PING_INTERVAL_MS,
  reconnectDelay,
  type CaseMessage,
} from "./protocol.js";

export type LinkStatus = "unsupported" | "disconnected" | "connecting" | "connected";

const STORED_DEVICE_KEY = "redqueen.caseDevice";
// On the phone: after this many failed attempts with the remembered case, search again
// (e.g. the ESP32 board was swapped).
const ATTEMPTS_BEFORE_RESCAN = 3;

// Bluetooth link to the ESP32 in the case: connects, keeps it alive with pings,
// and reconnects automatically when the connection drops. Uses the native Bluetooth
// stack in the phone app and Web Bluetooth in the browser.
export class CaseLink {
  status: LinkStatus = Capacitor.isNativePlatform() || navigator.bluetooth ? "disconnected" : "unsupported";
  lastHeartbeat?: number;
  private readonly native = Capacitor.isNativePlatform();
  private deviceId?: string;
  private initialized?: Promise<void>;
  private scanning = false;
  private reconnectAttempt = 0;
  private reconnectTimer?: number;
  private pingTimer?: number;
  private vialInPlace?: boolean;
  private sending: Promise<void> = Promise.resolve();
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();
  private readonly listeners = {
    status: [] as ((status: LinkStatus) => void)[],
    message: [] as ((message: CaseMessage) => void)[],
    vial: [] as ((inPlace: boolean) => void)[],
    log: [] as ((text: string) => void)[],
  };

  get alive(): boolean {
    return isAlive(this.status === "connected", this.lastHeartbeat, performance.now());
  }

  onStatus(listener: (status: LinkStatus) => void) {
    this.listeners.status.push(listener);
  }

  onMessage(listener: (message: CaseMessage) => void) {
    this.listeners.message.push(listener);
  }

  // Fires when the vial is removed or put back (not for the state reported right after connecting).
  onVial(listener: (inPlace: boolean) => void) {
    this.listeners.vial.push(listener);
  }

  onLog(listener: (text: string) => void) {
    this.listeners.log.push(listener);
  }

  // Shows the device picker; in the browser it must be called from a click.
  async pick() {
    if (this.status === "unsupported") return;
    try {
      await this.init();
      const device = await BleClient.requestDevice({ namePrefix: DEVICE_NAME, optionalServices: [NUS_SERVICE] });
      this.use(device.deviceId);
      await this.connect();
    } catch (error) {
      this.log(`picker closed: ${error}`);
    }
  }

  // Connects without the picker. The phone app reconnects to the remembered case, or
  // searches for one. The browser needs getDevices(), which some Chrome versions only
  // offer behind a flag.
  async restore(): Promise<boolean> {
    if (this.status === "unsupported") return false;
    const stored = localStorage.getItem(STORED_DEVICE_KEY);
    try {
      await this.init();
      if (this.native) {
        if (stored) {
          this.use(stored);
          await this.connect();
        } else {
          await this.scan();
        }
        return true;
      }
      if (!navigator.bluetooth?.getDevices) {
        this.log("getDevices() not available: click the dot to connect");
        return false;
      }
      const [device] = stored ? await BleClient.getDevices([stored]) : [];
      if (!device) return false;
      this.use(device.deviceId);
      await this.connect();
      return true;
    } catch (error) {
      this.log(`restore failed: ${error}`);
      return false;
    }
  }

  // Writes one at a time: a write while another is still in progress is rejected.
  send(line: string): Promise<void> {
    const deviceId = this.deviceId;
    const write = this.sending.then(async () => {
      if (!deviceId || this.status !== "connected") return;
      await BleClient.writeWithoutResponse(deviceId, NUS_SERVICE, NUS_RX, new DataView(this.encoder.encode(line).buffer));
    });
    this.sending = write.catch(() => {});
    return write;
  }

  private init(): Promise<void> {
    // On Android 12+ scanning then needs no location permission; Android 11 and older still do.
    this.initialized ??= BleClient.initialize({ androidNeverForLocation: true });
    return this.initialized;
  }

  // Phone app: searches until a case shows up, then connects to the first one.
  private async scan() {
    if (this.scanning) return;
    this.scanning = true;
    this.setStatus("connecting");
    this.log("searching for the case…");
    await BleClient.requestLEScan({ namePrefix: DEVICE_NAME }, async (result) => {
      if (!this.scanning) return;
      this.scanning = false;
      await BleClient.stopLEScan();
      this.log(`found ${result.device.name ?? result.device.deviceId}`);
      this.use(result.device.deviceId);
      await this.connect();
    });
  }

  private use(deviceId: string) {
    this.deviceId = deviceId;
    localStorage.setItem(STORED_DEVICE_KEY, deviceId);
  }

  private async connect() {
    const deviceId = this.deviceId;
    if (!deviceId) return;
    window.clearTimeout(this.reconnectTimer);
    this.setStatus("connecting");
    try {
      await BleClient.connect(deviceId, (id) => this.onDisconnected(id), { timeout: 10_000 });
      this.vialInPlace = undefined;
      await BleClient.startNotifications(deviceId, NUS_SERVICE, NUS_TX, (value) => this.receive(value));
      this.reconnectAttempt = 0;
      this.setStatus("connected");
      this.log(`connected to ${deviceId}`);
      // The case sends its status as soon as the link is up, usually before the notifications
      // are on, so ask again. Without it the vial has no baseline and the first removal is lost.
      this.send("STATUS").catch((error) => this.log(`status request failed: ${error}`));
      this.startPing();
    } catch (error) {
      this.log(`connect failed: ${error}`);
      await BleClient.disconnect(deviceId).catch(() => {});
      this.setStatus("disconnected");
      this.scheduleReconnect();
    }
  }

  private onDisconnected(deviceId: string) {
    if (deviceId !== this.deviceId || this.status === "disconnected") return;
    this.log("disconnected");
    this.stopPing();
    this.setStatus("disconnected");
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (!this.deviceId) return;
    if (this.native && this.reconnectAttempt >= ATTEMPTS_BEFORE_RESCAN) {
      this.log("remembered case not reachable: searching again");
      this.reconnectAttempt = 0;
      localStorage.removeItem(STORED_DEVICE_KEY);
      this.deviceId = undefined;
      this.scan().catch((error) => this.log(`scan failed: ${error}`));
      return;
    }
    const delay = reconnectDelay(this.reconnectAttempt++);
    this.log(`reconnecting in ${delay / 1000} s`);
    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
  }

  private receive(value: DataView) {
    const message = parseLine(this.decoder.decode(value));
    if (message.type === "heartbeat") this.lastHeartbeat = performance.now();
    if (message.type === "vial") {
      // The first state after connecting is only the baseline.
      const changed = this.vialInPlace !== undefined && this.vialInPlace !== message.inPlace;
      this.vialInPlace = message.inPlace;
      if (changed) for (const listener of this.listeners.vial) listener(message.inPlace);
    }
    for (const listener of this.listeners.message) listener(message);
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = window.setInterval(() => {
      this.send("PING").catch((error) => this.log(`ping failed: ${error}`));
    }, PING_INTERVAL_MS);
  }

  private stopPing() {
    window.clearInterval(this.pingTimer);
  }

  private setStatus(status: LinkStatus) {
    this.status = status;
    for (const listener of this.listeners.status) listener(status);
  }

  private log(text: string) {
    for (const listener of this.listeners.log) listener(text);
  }
}
