import { describe, expect, it } from "vitest";
import { parseDeviceConfig } from "./deviceConfig.js";

const complete = { mistralApiKey: "key", agents: { en: "a1", de: "a2" }, clearanceCode: "ALPHA-77" };

describe("parseDeviceConfig", () => {
  it("accepts a complete config", () => {
    expect(parseDeviceConfig(JSON.stringify(complete))).toEqual(complete);
  });

  it("names the missing fields", () => {
    const { mistralApiKey, ...rest } = complete;
    expect(() => parseDeviceConfig(JSON.stringify({ ...rest, agents: { en: "a1" } }))).toThrow(
      /mistralApiKey, agents\.de/,
    );
  });

  it("rejects a broken file", () => {
    expect(() => parseDeviceConfig("{")).toThrow(/unreadable/);
  });
});
