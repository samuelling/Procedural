// Sound, synthesised: wind as filtered noise that swells and fades, and birds as short swept tones.
/* global TIER */
export function mkAudio() {
  const ac = new (window.AudioContext || window.webkitAudioContext)(), out = ac.createGain(); out.gain.value = 0.5; out.connect(ac.destination);
  const nb = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate), d = nb.getChannelData(0); let b = 0;
  for (let i = 0; i < d.length; i++) { b = b * 0.985 + (Math.random() * 2 - 1) * 0.12; d[i] = b; }
  const src = ac.createBufferSource(); src.buffer = nb; src.loop = true; src.start();
  const mk = (type, f, q) => { const fl = ac.createBiquadFilter(), g = ac.createGain(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0; src.connect(fl); fl.connect(g); g.connect(out); return { fl, g }; };
  const low = mk('bandpass', 320, 0.5), leaves = mk('highpass', 2600, 0.3);
  const rain = TIER > 2 && mk('highpass', 4200, 0.4), brook = TIER > 2 && mk('bandpass', 1500, 1.4), thun = TIER > 3 && mk('lowpass', 110, 0.5), burn = TIER > 3 && mk('bandpass', 1300, 0.7);
  let wind = 0.5, day = 1, next = 0, nt = 0, nx2 = 0, se = 1, rn = 0;
  // calls: a few notes each, as [from Hz, to Hz, seconds a note, how many, seconds apart, wave, loudness]
  const ev = TIER > 3 && ((k) => {
    const E = { roar: [105, 70, 1.5, 1, 0, 'sawtooth', 0.1], frog: [430, 380, 0.08, 5, 0.13, 'square', 0.015], wood: [1000, 800, 0.018, 13, 0.055, 'square', 0.03], cuckoo: [660, 520, 0.26, 2, 0.34, 'sine', 0.05], bark: [760, 480, 0.11, 3, 0.24, 'sawtooth', 0.03], squeal: [1900, 1300, 0.14, 2, 0.17, 'sine', 0.03], howl: [330, 520, 1.9, 2, 1.3, 'sine', 0.05],
      // songs, sketched from memory and not yet checked against recordings
      thrush: [1900, 3500, 0.13, 5, 0.19, 'sine', 0.02], robin: [2300, 4100, 0.09, 7, 0.14, 'sine', 0.018], wren: [3600, 6400, 0.04, 14, 0.06, 'sine', 0.014], chickadee: [3900, 3300, 0.3, 2, 0.4, 'sine', 0.02], warbler: [4100, 6900, 0.06, 8, 0.1, 'sine', 0.014],
      nuthatch: [2100, 2400, 0.07, 6, 0.16, 'triangle', 0.016], finch: [2700, 4900, 0.07, 9, 0.1, 'sine', 0.016], dove: [470, 540, 0.4, 3, 0.65, 'sine', 0.03], kinglet: [6200, 7800, 0.05, 10, 0.09, 'sine', 0.01], crossbill: [2900, 3400, 0.05, 4, 0.12, 'triangle', 0.016], cicada: [4300, 4500, 0.012, 60, 0.02, 'square', 0.005] }[k];
    const t = ac.currentTime + 0.05, lp = ac.createBiquadFilter(); lp.frequency.value = k === 'roar' ? 600 : 6000; lp.connect(out);
    for (let i = 0; i < E[3]; i++) {
      const o = ac.createOscillator(), g = ac.createGain(), s = t + i * E[4]; o.type = E[5]; o.frequency.setValueAtTime(k === 'cuckoo' && i ? E[1] : E[0], s); if (k !== 'cuckoo') o.frequency.exponentialRampToValueAtTime(E[1], s + E[2]);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(E[6], s + E[2] * 0.2); g.gain.linearRampToValueAtTime(0, s + E[2]); o.connect(g); g.connect(lp); o.start(s); o.stop(s + E[2] + 0.02);
    }
  });
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
    if (TIER > 3 && ac.state === 'running' && rn < 0.3) { const r = Math.random(); if (nt < 0.3 && r < 0.012) ev('wood'); else if (nt < 0.3 && r < 0.05 + 0.2 * Math.max(0, 0.2 - ev.d) * 5) { const W = { mixed: ['thrush', 'robin', 'wren', 'nuthatch', 'dove'], boreal: ['kinglet', 'crossbill', 'chickadee', 'thrush'], oldgrowth: ['wren', 'thrush', 'kinglet', 'chickadee'], aspen: ['warbler', 'finch', 'robin', 'chickadee'], beech: ['thrush', 'robin', 'nuthatch', 'dove', 'finch'], carr: ['warbler', 'wren', 'finch'], pine: ['crossbill', 'nuthatch', 'chickadee', 'dove'], larch: ['finch', 'kinglet', 'crossbill'], redwood: ['wren', 'thrush', 'kinglet'], cloud: ['wren', 'warbler', 'thrush'], moss: [] }, b = W[ev.k] || W.mixed; ev(b[(Math.random() * b.length) | 0]); }   // who sings depends on the wood; most of all at dawn
      else if (nt < 0.3 && se === 0 && r < 0.03) ev('cuckoo'); else if (nt < 0.3 && se === 1 && ev.d > 0.35 && r > 0.975) ev('cicada'); else if (nt > 0.6 && r < 0.006) ev('bark'); }   // a woodpecker, a cuckoo in spring, a fox at night
    if (t > next && ac.state === 'running') { if (Math.random() < day) bird(t + 0.05); next = t + 0.5 + Math.random() * 3.5; }
  }, 250);
  const A = { ac, set(w, dy) { wind = w; day = dy; },
    boom: TIER > 3 && (() => { const t = ac.currentTime + 0.4 + Math.random() * 2; thun.g.gain.setValueAtTime(0, t); thun.g.gain.linearRampToValueAtTime(9, t + 0.08); thun.g.gain.setTargetAtTime(0, t + 0.3, 1.1); }),   // thunder follows the flash
    // rain is hiss; the brook is a narrow band of the same noise, jostled quickly, louder as you come near
    ev, fx: TIER > 2 && ((r, s, n, sn, fi, k, d) => { nt = n; se = sn; rn = r; if (TIER > 3) { ev.k = k; ev.d = d; } const t = ac.currentTime; if (TIER > 3) burn.g.gain.setTargetAtTime(fi * (0.3 + 3 * Math.random() ** 3), t, 0.05); rain.g.gain.setTargetAtTime(r * 0.8, t, 0.4); brook.g.gain.setTargetAtTime(s * s * (0.7 + 0.9 * Math.random()), t, 0.07); brook.fl.frequency.setTargetAtTime(1100 + 900 * Math.random(), t, 0.1); }) };
  if (TIER > 3) {                                                          // footsteps. k: 0 moss, 1 dry leaves, 2 bare ground, 3 snow, 4 water
    const wn = ac.createBuffer(1, ac.sampleRate * 0.4, ac.sampleRate), c = wn.getChannelData(0); for (let i = 0; i < c.length; i++) c[i] = Math.random() * 2 - 1;
    A.step = (k, v, twig) => {                                             // dry leaves crackle in a burst, moss thuds, snow squeaks, water sloshes, a twig snaps
      if (ac.state !== 'running') return; const t = ac.currentTime;
      for (let i = 0, n = k === 1 ? 4 + ((Math.random() * 4) | 0) : twig ? 2 : 1; i < n; i++) {
        const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(), t0 = t + (k === 1 ? i * (0.012 + Math.random() * 0.03) : i * 0.03), d = [0.09, 0.025, 0.06, 0.13, 0.3][k] * (twig ? 0.4 : 1);
        s.buffer = wn; s.playbackRate.value = 0.7 + Math.random() * 0.6; fl.type = k === 0 || k === 4 ? 'lowpass' : 'bandpass'; fl.frequency.value = twig ? 2600 : [520, 3400, 900, 1700, 700][k] * (0.8 + Math.random() * 0.4); fl.Q.value = k === 3 ? 6 : 1.2;
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v * (twig ? 0.9 : [0.35, 0.16, 0.3, 0.22, 0.4][k]), t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0005, t0 + d);
        s.connect(fl); fl.connect(g); g.connect(out); s.start(t0, Math.random() * 0.3); s.stop(t0 + d + 0.02);
      }
    };
  }
  return A;
}
