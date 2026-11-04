import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VoiceMeter } from "../render/voiceMeter.js";
import { VoiceLinePlayer } from "./voicelines.js";

// Stand-in for HTMLAudioElement: "plays" until finish() or pause().
class FakeAudio extends EventTarget {
  static all: FakeAudio[] = [];
  static missing: string[] = [];
  playing = false;
  constructor(readonly src: string) {
    super();
    FakeAudio.all.push(this);
  }
  play() {
    if (FakeAudio.missing.some((part) => this.src.includes(part))) {
      queueMicrotask(() => this.dispatchEvent(new Event("error")));
      return Promise.reject(new DOMException("missing", "NotSupportedError"));
    }
    this.playing = true;
    return Promise.resolve();
  }
  pause() {
    this.playing = false;
  }
  finish() {
    this.playing = false;
    this.dispatchEvent(new Event("ended"));
  }
}

const meter = { connectElement: () => {} } as unknown as VoiceMeter;
const playing = () => FakeAudio.all.filter((a) => a.playing).map((a) => a.src.split("/").pop());
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("VoiceLinePlayer", () => {
  beforeEach(() => {
    FakeAudio.all = [];
    FakeAudio.missing = [];
    vi.stubGlobal("Audio", FakeAudio);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("cuts off the current line when another one starts", async () => {
    const player = new VoiceLinePlayer(meter);
    const first = player.play(["A", "B"]);
    await flush();
    player.play(["C"]);
    await flush();
    expect(playing()).toEqual(["C.mp3"]);
    await first; // the old sequence ends instead of going on to B
    await flush();
    expect(playing()).toEqual(["C.mp3"]);
    expect(FakeAudio.all.map((a) => a.src.split("/").pop())).toEqual(["A.mp3", "C.mp3"]);
  });

  it("plays a sequence in order and stops it on stop()", async () => {
    const player = new VoiceLinePlayer(meter);
    const done = player.play(["A", "B", "C"]);
    await flush();
    FakeAudio.all[0].finish();
    await flush();
    expect(playing()).toEqual(["B.mp3"]);
    player.stop();
    await done;
    expect(playing()).toEqual([]);
    expect(FakeAudio.all).toHaveLength(2);
  });

  it("falls back to the next source when a file is missing", async () => {
    FakeAudio.missing = ["/generated/en/B"];
    const player = new VoiceLinePlayer(meter);
    player.sources = ["/generated", "/voicelines"];
    player.play(["B"]);
    await flush();
    await flush();
    expect(FakeAudio.all.map((a) => a.src)).toEqual(["/generated/en/B.mp3", "/voicelines/en/B.mp3"]);
    expect(playing()).toEqual(["B.mp3"]);
  });
});
