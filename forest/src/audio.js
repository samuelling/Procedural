// Sound, synthesised: wind as filtered noise that swells and fades, and birds as short swept tones.
export function mkAudio() {
  const ac = new (window.AudioContext || window.webkitAudioContext)(), out = ac.createGain(); out.gain.value = 0.5; out.connect(ac.destination);
  const nb = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate), d = nb.getChannelData(0); let b = 0;
  for (let i = 0; i < d.length; i++) { b = b * 0.985 + (Math.random() * 2 - 1) * 0.12; d[i] = b; }
  const src = ac.createBufferSource(); src.buffer = nb; src.loop = true; src.start();
  const mk = (type, f, q) => { const fl = ac.createBiquadFilter(), g = ac.createGain(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0; src.connect(fl); fl.connect(g); g.connect(out); return { fl, g }; };
  const low = mk('bandpass', 320, 0.5), leaves = mk('highpass', 2600, 0.3);
  let wind = 0.5, day = 1, next = 0;
  const bird = (t) => {
    const f0 = 1800 + Math.random() * 2600, n = 2 + ((Math.random() * 5) | 0), pan = ac.createStereoPanner ? ac.createStereoPanner() : ac.createGain(); if (pan.pan) pan.pan.value = Math.random() * 2 - 1; pan.connect(out);
    for (let k = 0; k < n; k++) {
      const o = ac.createOscillator(), g = ac.createGain(), s = t + k * (0.09 + Math.random() * 0.06), up = Math.random() < 0.5 ? 1.25 : 0.8;
      o.frequency.setValueAtTime(f0 * (1 + 0.1 * Math.sin(k * 2.1)), s); o.frequency.exponentialRampToValueAtTime(f0 * up, s + 0.07);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.035, s + 0.012); g.gain.exponentialRampToValueAtTime(0.0005, s + 0.085);
      o.connect(g); g.connect(pan); o.start(s); o.stop(s + 0.1);
    }
  };
  setInterval(() => {
    const t = ac.currentTime, gust = 0.5 + 0.5 * Math.sin(t * 0.21) * Math.sin(t * 0.083 + 1);
    low.g.gain.setTargetAtTime(0.25 + 1.1 * wind * gust, t, 0.6); leaves.g.gain.setTargetAtTime(0.5 * wind * gust * gust, t, 0.5); low.fl.frequency.setTargetAtTime(260 + 260 * gust, t, 0.8);
    if (t > next && ac.state === 'running') { if (Math.random() < day) bird(t + 0.05); next = t + 0.5 + Math.random() * 3.5; }
  }, 250);
  return { ac, set(w, dy) { wind = w; day = dy; } };
}
