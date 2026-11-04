import { describe, expect, it } from "vitest";
import { HEARTBEAT_TIMEOUT_MS, isAlive, parseLine, reconnectDelay } from "./protocol.js";

describe("parseLine", () => {
  it("parses heartbeats", () => {
    expect(parseLine("HB:12:24")).toEqual({ type: "heartbeat", counter: 12, uptimeSeconds: 24 });
  });

  it("parses vial states", () => {
    expect(parseLine("VIAL:0")).toEqual({ type: "vial", inPlace: false });
    expect(parseLine("VIAL:1\n")).toEqual({ type: "vial", inPlace: true });
  });

  it("parses the case state", () => {
    expect(parseLine("DRAWER:OPENING")).toEqual({ type: "drawer", state: "OPENING" });
    expect(parseLine("LID:1")).toEqual({ type: "lid", open: true });
    expect(parseLine("MIST:OFF")).toEqual({ type: "mist", on: false });
    expect(parseLine("SW:CLOSED:1")).toEqual({ type: "switch", name: "CLOSED", pressed: true });
    expect(parseLine("LED:COUNTDOWN")).toEqual({ type: "lights", effect: "COUNTDOWN" });
    expect(parseLine("BRIGHTNESS:160")).toEqual({ type: "brightness", value: 160 });
    expect(parseLine("BTN:OVERRIDE")).toEqual({ type: "button", name: "OVERRIDE" });
    expect(parseLine("FW:2.1")).toEqual({ type: "firmware", version: "2.1" });
    expect(parseLine("ERR:UNKNOWN:FOO")).toEqual({ type: "error", text: "UNKNOWN:FOO" });
  });

  it("keeps malformed state lines as unknown", () => {
    expect(parseLine("DRAWER:SIDEWAYS")).toEqual({ type: "unknown", line: "DRAWER:SIDEWAYS" });
    expect(parseLine("SW:LID:1")).toEqual({ type: "unknown", line: "SW:LID:1" });
  });

  it("parses pong and keeps unknown lines", () => {
    expect(parseLine("PONG")).toEqual({ type: "pong" });
    expect(parseLine("HELLO")).toEqual({ type: "unknown", line: "HELLO" });
  });
});

describe("reconnectDelay", () => {
  it("backs off and then stays at 10 s", () => {
    expect([0, 1, 2, 3, 4, 9].map(reconnectDelay)).toEqual([1000, 2000, 4000, 8000, 10000, 10000]);
  });
});

describe("isAlive", () => {
  it("needs a connection and a recent heartbeat", () => {
    expect(isAlive(true, 1000, 1000 + HEARTBEAT_TIMEOUT_MS - 1)).toBe(true);
    expect(isAlive(true, 1000, 1000 + HEARTBEAT_TIMEOUT_MS)).toBe(false);
    expect(isAlive(false, 1000, 1000)).toBe(false);
    expect(isAlive(true, undefined, 1000)).toBe(false);
  });
});
