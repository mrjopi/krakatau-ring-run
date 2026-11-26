// Procedural sound, no audio files: an engine drone that follows the
// throttle, filtered wind noise, a chime for rings and a thud for crashes.
// Everything starts on the first user gesture, so browsers allow it.
export function buildAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch {
      return false;
    }
    // Engine: two detuned saws through a low-pass, pitch follows throttle.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 62;
    const engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 93;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    engineOsc.connect(filter);
    engineOsc2.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
    engineOsc2.start();
    // Wind: looped noise buffer through a band-pass.
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 480;
    band.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0.0;
    noise.connect(band);
    band.connect(windGain);
    windGain.connect(ctx.destination);
    noise.start();
    return true;
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    setMuted(m) {
      muted = m;
      if (ctx && engineGain) engineGain.gain.value = m ? 0 : 0.05;
    },
    isMuted() {
      return muted;
    },
    /** Called every frame while flying. */
    update(throttle, speed, flying) {
      if (!ctx || muted) return;
      const target = flying ? 0.028 + throttle * 0.05 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      if (engineOsc) engineOsc.frequency.setTargetAtTime(58 + throttle * 70 + speed * 0.35, ctx.currentTime, 0.1);
      windGain.gain.setTargetAtTime(flying ? Math.min(0.06, speed * 0.0007) : 0, ctx.currentTime, 0.15);
    },
    ring() {
      tone(880, 0.35, 'sine', 0.22);
      tone(1318, 0.4, 'sine', 0.16, 0.07);
    },
    landing() {
      tone(523, 0.3, 'triangle', 0.2);
      tone(784, 0.45, 'triangle', 0.18, 0.1);
    },
    crash() {
      tone(70, 0.5, 'square', 0.25);
      tone(48, 0.7, 'sawtooth', 0.2, 0.05);
    },
    click() {
      tone(660, 0.08, 'square', 0.1);
    },
  };
}
