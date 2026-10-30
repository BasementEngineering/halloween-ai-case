// Measures how loud the Red Queen is speaking: her live voice (remote audio track)
// and the pre-recorded lines. The live voice is played by the SDK; this only listens.
export class VoiceMeter {
  private readonly context = new AudioContext();
  private readonly analyser = this.context.createAnalyser();
  private readonly samples = new Float32Array(512);
  private trackSource?: MediaStreamAudioSourceNode;
  private level = 0;

  constructor() {
    this.analyser.fftSize = this.samples.length;
  }

  // Call from a click handler, so the browser allows audio.
  resume() {
    return this.context.resume();
  }

  attach(track: MediaStreamTrack) {
    this.detach();
    this.trackSource = this.context.createMediaStreamSource(new MediaStream([track]));
    this.trackSource.connect(this.analyser);
  }

  detach() {
    this.trackSource?.disconnect();
    this.trackSource = undefined;
  }

  // Routes an audio element through the meter to the speakers.
  connectElement(audio: HTMLAudioElement) {
    const source = this.context.createMediaElementSource(audio);
    source.connect(this.analyser);
    source.connect(this.context.destination);
  }

  // 0..1, smoothed
  read(): number {
    this.analyser.getFloatTimeDomainData(this.samples);
    let sum = 0;
    for (const sample of this.samples) sum += sample * sample;
    const rms = Math.sqrt(sum / this.samples.length);
    const target = Math.min(1, rms * 6);
    this.level += (target - this.level) * (target > this.level ? 0.5 : 0.1);
    return this.level;
  }
}
