/// <reference types="web-bluetooth" />
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

// Bluetooth link to the ESP32 in the case: connects, keeps it alive with pings,
// and reconnects automatically when the connection drops.
export class CaseLink {
  status: LinkStatus = navigator.bluetooth ? "disconnected" : "unsupported";
  lastHeartbeat?: number;
  private device?: BluetoothDevice;
  private rx?: BluetoothRemoteGATTCharacteristic;
  private reconnectAttempt = 0;
  private reconnectTimer?: number;
  private pingTimer?: number;
  private vialInPlace?: boolean;
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

  // Shows Chrome's device picker; must be called from a click.
  async pick() {
    if (!navigator.bluetooth) return;
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: DEVICE_NAME }],
        optionalServices: [NUS_SERVICE],
      });
      this.use(device);
      await this.connect();
    } catch (error) {
      this.log(`picker closed: ${error}`);
    }
  }

  // Reconnects to a device allowed earlier, without the picker. Needs getDevices(),
  // which some Chrome versions only offer behind a flag.
  async restore(): Promise<boolean> {
    if (!navigator.bluetooth?.getDevices) {
      this.log("getDevices() not available: click the dot to connect");
      return false;
    }
    const device = (await navigator.bluetooth.getDevices()).find((d) => d.name?.startsWith(DEVICE_NAME));
    if (!device) return false;
    this.use(device);
    await this.connect();
    return true;
  }

  async send(line: string) {
    await this.rx?.writeValueWithoutResponse(this.encoder.encode(line));
  }

  private use(device: BluetoothDevice) {
    if (this.device === device) return;
    this.device = device;
    device.addEventListener("gattserverdisconnected", () => {
      this.log("disconnected");
      this.stopPing();
      this.rx = undefined;
      this.setStatus("disconnected");
      this.scheduleReconnect();
    });
  }

  private async connect() {
    const device = this.device;
    if (!device?.gatt) return;
    window.clearTimeout(this.reconnectTimer);
    this.setStatus("connecting");
    try {
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(NUS_SERVICE);
      const tx = await service.getCharacteristic(NUS_TX);
      this.rx = await service.getCharacteristic(NUS_RX);
      tx.addEventListener("characteristicvaluechanged", () => this.receive(tx.value));
      await tx.startNotifications();
      this.reconnectAttempt = 0;
      this.vialInPlace = undefined;
      this.setStatus("connected");
      this.log(`connected to ${device.name}`);
      this.startPing();
    } catch (error) {
      this.log(`connect failed: ${error}`);
      this.setStatus("disconnected");
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.device) return;
    const delay = reconnectDelay(this.reconnectAttempt++);
    this.log(`reconnecting in ${delay / 1000} s`);
    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
  }

  private receive(value?: DataView) {
    if (!value) return;
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
