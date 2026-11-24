// Sound, synthesised: wind as filtered noise that swells and fades, and birds as short swept tones.
/* global TIER */
export function mkAudio() {
  const ac = new (window.AudioContext || window.webkitAudioContext)(), out = ac.createGain(); out.gain.value = 0.5; out.connect(ac.destination);
  const nb = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate), d = nb.getChannelData(0); let b = 0;
  for (let i = 0; i < d.length; i++) { b = b * 0.985 + (Math.random() * 2 - 1) * 0.12; d[i] = b; }
  const src = ac.createBufferSource(); src.buffer = nb; src.loop = true; src.start();
  const mk = (type, f, q) => { const fl = ac.createBiquadFilter(), g = ac.createGain(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0; src.connect(fl); fl.connect(g); g.connect(out); return { fl, g }; };
  const low = mk('bandpass', 320, 0.5), leaves = mk('highpass', 2600, 0.3);
  const rain = TIER > 2 && mk('highpass', 4200, 0.4), brook = TIER > 2 && mk('bandpass', 1500, 1.4), thun = TIER > 3 && mk('lowpass', 110, 0.5);
  let wind = 0.5, day = 1, next = 0, nt = 0, nx2 = 0;
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
    if (TIER > 3 && nt > 0.5 && t > nx2 && ac.state === 'running') {      // after dark: crickets, and now and then an owl
      const owl = Math.random() < 0.18, o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(out); o.frequency.value = owl ? 330 : 4300 + Math.random() * 500;
      for (let k = 0; k < (owl ? 2 : 5); k++) { const s = t + k * (owl ? 0.55 : 0.085), d = owl ? 0.4 : 0.035; g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(owl ? 0.06 : 0.012, s + d * 0.3); g.gain.linearRampToValueAtTime(0, s + d); }
      o.start(t); o.stop(t + 1.4); nx2 = t + (owl ? 4 : 0.6) + Math.random() * 1.5;
    }
    if (t > next && ac.state === 'running') { if (Math.random() < day) bird(t + 0.05); next = t + 0.5 + Math.random() * 3.5; }
  }, 250);
  return { ac, set(w, dy) { wind = w; day = dy; },
    boom: TIER > 3 && (() => { const t = ac.currentTime + 0.4 + Math.random() * 2; thun.g.gain.setValueAtTime(0, t); thun.g.gain.linearRampToValueAtTime(9, t + 0.08); thun.g.gain.setTargetAtTime(0, t + 0.3, 1.1); }),   // thunder follows the flash
    // rain is hiss; the brook is a narrow band of the same noise, jostled quickly, louder as you come near
    fx: TIER > 2 && ((r, s, n) => { nt = n; const t = ac.currentTime; rain.g.gain.setTargetAtTime(r * 0.8, t, 0.4); brook.g.gain.setTargetAtTime(s * s * (0.7 + 0.9 * Math.random()), t, 0.07); brook.fl.frequency.setTargetAtTime(1100 + 900 * Math.random(), t, 0.1); }) };
}
