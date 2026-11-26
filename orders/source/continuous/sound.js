// Sound, synthesised and nothing stored: wind as filtered noise that swells and fades, rain as hiss, fire as a crackling
// band of it, thunder as its low end; birds by day and crickets and owls by night as short swept tones; footsteps that
// depend on what is underfoot. It follows where the camera is: quieter with height, none above the air or on an
// airless world, muffled under water and in the microscope's small world. (From the forest rungs' sound, src/audio.js.)
export function mkSound() {
  const ac = new (window.AudioContext || window.webkitAudioContext)(), out = ac.createGain(), muf = ac.createBiquadFilter();
  muf.type = 'lowpass'; muf.frequency.value = 18000; out.gain.value = 0; muf.connect(out); out.connect(ac.destination);
  const nb = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate), d = nb.getChannelData(0); let b = 0;
  for (let i = 0; i < d.length; i++) { b = b * 0.985 + (Math.random() * 2 - 1) * 0.12; d[i] = b; }
  const src = ac.createBufferSource(); src.buffer = nb; src.loop = true; src.start();
  const mk = (type, f, q) => { const fl = ac.createBiquadFilter(), g = ac.createGain(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0; src.connect(fl); fl.connect(g); g.connect(muf); return { fl, g }; };
  const low = mk('bandpass', 320, 0.5), leaves = mk('highpass', 2600, 0.3), rain = mk('highpass', 4200, 0.4), thun = mk('lowpass', 110, 0.5), burn = mk('bandpass', 1300, 0.7);
  let st = { wind: 0.5, day: 1, night: 0, rain: 0, fire: 0, life: 1, birds: 'mixed', spring: 0, vol: 0 }, next = 0, nx2 = 0;
  // calls: a few notes each, as [from Hz, to Hz, seconds a note, how many, seconds apart, wave, loudness] (sketched, not checked against recordings)
  const E = { frog: [430, 380, 0.08, 5, 0.13, 'square', 0.015], wood: [1000, 800, 0.018, 13, 0.055, 'square', 0.03], cuckoo: [660, 520, 0.26, 2, 0.34, 'sine', 0.05], bark: [760, 480, 0.11, 3, 0.24, 'sawtooth', 0.03],
    thrush: [1900, 3500, 0.13, 5, 0.19, 'sine', 0.02], robin: [2300, 4100, 0.09, 7, 0.14, 'sine', 0.018], wren: [3600, 6400, 0.04, 14, 0.06, 'sine', 0.014], chickadee: [3900, 3300, 0.3, 2, 0.4, 'sine', 0.02], warbler: [4100, 6900, 0.06, 8, 0.1, 'sine', 0.014],
    nuthatch: [2100, 2400, 0.07, 6, 0.16, 'triangle', 0.016], finch: [2700, 4900, 0.07, 9, 0.1, 'sine', 0.016], dove: [470, 540, 0.4, 3, 0.65, 'sine', 0.03], kinglet: [6200, 7800, 0.05, 10, 0.09, 'sine', 0.01], crossbill: [2900, 3400, 0.05, 4, 0.12, 'triangle', 0.016],
    cicada: [4300, 4500, 0.012, 60, 0.02, 'square', 0.005], parrot: [1500, 900, 0.09, 3, 0.16, 'sawtooth', 0.02] };
  const W = { mixed: ['thrush', 'robin', 'wren', 'nuthatch', 'dove'], boreal: ['kinglet', 'crossbill', 'chickadee', 'thrush'], tropic: ['parrot', 'dove', 'warbler', 'cicada'], dry: ['dove', 'finch'], none: [] };
  const ev = (k) => {
    const e = E[k], t = ac.currentTime + 0.05, lp = ac.createBiquadFilter(), pan = ac.createStereoPanner ? ac.createStereoPanner() : ac.createGain(); lp.frequency.value = 6000; lp.connect(pan); pan.connect(muf); if (pan.pan) pan.pan.value = Math.random() * 1.6 - 0.8;
    for (let i = 0; i < e[3]; i++) {
      const o = ac.createOscillator(), g = ac.createGain(), s = t + i * e[4]; o.type = e[5]; o.frequency.setValueAtTime(k === 'cuckoo' && i ? e[1] : e[0], s); if (k !== 'cuckoo') o.frequency.exponentialRampToValueAtTime(e[1], s + e[2]);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(e[6] * st.life, s + e[2] * 0.2); g.gain.linearRampToValueAtTime(0, s + e[2]); o.connect(g); g.connect(lp); o.start(s); o.stop(s + e[2] + 0.02);
    }
  };
  const bird = (t) => {                                                    // an anonymous chirp, the background to the named songs
    const f0 = 1800 + Math.random() * 2600, n = 2 + ((Math.random() * 5) | 0), pan = ac.createStereoPanner ? ac.createStereoPanner() : ac.createGain(); if (pan.pan) pan.pan.value = Math.random() * 2 - 1; pan.connect(muf);
    for (let k = 0; k < n; k++) {
      const o = ac.createOscillator(), g = ac.createGain(), s = t + k * (0.09 + Math.random() * 0.06), up = Math.random() < 0.5 ? 1.25 : 0.8;
      o.frequency.setValueAtTime(f0 * (1 + 0.1 * Math.sin(k * 2.1)), s); o.frequency.exponentialRampToValueAtTime(f0 * up, s + 0.07);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.035 * st.life, s + 0.012); g.gain.exponentialRampToValueAtTime(0.0005, s + 0.085);
      o.connect(g); g.connect(pan); o.start(s); o.stop(s + 0.1);
    }
  };
  setInterval(() => {
    if (ac.state !== 'running') return;
    const t = ac.currentTime, gust = 0.5 + 0.5 * Math.sin(t * 0.21) * Math.sin(t * 0.083 + 1), w = st.wind;
    out.gain.setTargetAtTime(st.vol * 0.5, t, 0.4);
    low.g.gain.setTargetAtTime(0.25 * st.life + 1.1 * w * gust, t, 0.6); leaves.g.gain.setTargetAtTime(0.5 * w * gust * gust * st.life, t, 0.5); low.fl.frequency.setTargetAtTime(260 + 260 * gust, t, 0.8);
    rain.g.gain.setTargetAtTime(st.rain * 0.8, t, 0.4); burn.g.gain.setTargetAtTime(st.fire * (0.3 + 3 * Math.random() ** 3), t, 0.05);
    if (st.life < 0.05 || st.vol < 0.01) return;
    if (st.night > 0.5 && t > nx2) {                                       // after dark: crickets, and now and then an owl
      const owl = Math.random() < 0.18, o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(muf); o.frequency.value = owl ? 330 : 4300 + Math.random() * 500;
      for (let k = 0; k < (owl ? 2 : 5); k++) { const s = t + k * (owl ? 0.55 : 0.085), dd = owl ? 0.4 : 0.035; g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime((owl ? 0.06 : 0.012) * st.life, s + dd * 0.3); g.gain.linearRampToValueAtTime(0, s + dd); }
      o.start(t); o.stop(t + 1.4); nx2 = t + (owl ? 4 : 0.6) + Math.random() * 1.5;
    }
    if (st.rain < 0.3) { const r = Math.random(), B = W[st.birds] || W.mixed;   // who sings depends on the woods; most of all in the morning
      if (st.night < 0.3 && B.length && r < 0.012) ev('wood');
      else if (st.night < 0.3 && B.length && r < 0.06 * st.day) ev(B[(Math.random() * B.length) | 0]);
      else if (st.night < 0.3 && st.spring && st.birds !== 'tropic' && r > 0.99) ev('cuckoo'); else if (st.night > 0.6 && r < 0.006) ev('bark'); }
    if (t > next) { if (B0() && st.rain < 0.5 && Math.random() < st.day) bird(t + 0.05); next = t + 0.5 + Math.random() * 3.5; }
  }, 250);
  const B0 = () => (W[st.birds] || W.mixed).length > 0;
  const wn = ac.createBuffer(1, ac.sampleRate * 0.4, ac.sampleRate), c = wn.getChannelData(0); for (let i = 0; i < c.length; i++) c[i] = Math.random() * 2 - 1;
  return {
    ac,
    set(o) { st = { ...st, ...o }; muf.frequency.setTargetAtTime(o.muffle ? 500 : 18000, ac.currentTime, 0.15); },
    boom(far) { const t = ac.currentTime + (far ? 0.4 + Math.random() * 2 : 0.05); thun.g.gain.setValueAtTime(0, t); thun.g.gain.linearRampToValueAtTime(9, t + 0.08); thun.g.gain.setTargetAtTime(0, t + 0.3, 1.1); },   // thunder follows the flash
    step(k, v, twig) {                                                      // k: 0 moss, 1 dry leaves, 2 bare ground, 3 snow, 4 water. Leaves crackle, moss thuds, snow squeaks, water sloshes
      if (ac.state !== 'running' || st.vol < 0.01) return; const t = ac.currentTime;
      for (let i = 0, n = k === 1 ? 4 + ((Math.random() * 4) | 0) : twig ? 2 : 1; i < n; i++) {
        const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(), t0 = t + (k === 1 ? i * (0.012 + Math.random() * 0.03) : i * 0.03), dd = [0.09, 0.025, 0.06, 0.13, 0.3][k] * (twig ? 0.4 : 1);
        s.buffer = wn; s.playbackRate.value = 0.7 + Math.random() * 0.6; fl.type = k === 0 || k === 4 ? 'lowpass' : 'bandpass'; fl.frequency.value = twig ? 2600 : [520, 3400, 900, 1700, 700][k] * (0.8 + Math.random() * 0.4); fl.Q.value = k === 3 ? 6 : 1.2;
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v * (twig ? 0.9 : [0.35, 0.16, 0.3, 0.22, 0.4][k]), t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dd);
        s.connect(fl); fl.connect(g); g.connect(muf); s.start(t0, Math.random() * 0.3); s.stop(t0 + dd + 0.02);
      }
    },
  };
}
