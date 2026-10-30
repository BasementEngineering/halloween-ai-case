let context: AudioContext | undefined;

// Alarm beeps when the vial is removed, synthesised so no file is needed.
export async function playAlert(beeps = 3): Promise<void> {
  context ??= new AudioContext();
  await context.resume();
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
  }

  await new Promise((resolve) => setTimeout(resolve, (beeps * interval + 0.2) * 1000));
}
