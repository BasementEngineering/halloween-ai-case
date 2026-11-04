let context: AudioContext | undefined;
let running: OscillatorNode[] = [];
let finish: (() => void) | undefined;

// Alarm beeps when the vial is removed, synthesised so no file is needed.
export async function playAlert(beeps = 3): Promise<void> {
  context ??= new AudioContext();
  await context.resume();
  stopAlert();
  const start = context.currentTime + 0.05;
  const interval = 0.4;

  for (let i = 0; i < beeps; i++) {
    const t = start + i * interval;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(i % 2 ? 660 : 880, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.01);
    gain.gain.setValueAtTime(0.15, t + 0.2);
    gain.gain.linearRampToValueAtTime(0, t + 0.25);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(t);
    oscillator.stop(t + 0.3);
    running.push(oscillator);
  }

  await new Promise<void>((resolve) => {
    const timer = setTimeout(done, (beeps * interval + 0.2) * 1000);
    function done() {
      clearTimeout(timer);
      if (finish === done) finish = undefined;
      running = [];
      resolve();
    }
    finish = done;
  });
}

// Cuts the beeps off, e.g. when the vial is put straight back. playAlert() then resolves.
export function stopAlert() {
  for (const oscillator of running) {
    try {
      oscillator.stop();
    } catch {
      // already stopped
    }
  }
  running = [];
  finish?.();
}
