// Spikes as sound: each one a short note, pitched by how deep the cell sits (a minor pentatonic scale,
// low notes for deep layers), panned by where it is. Inhibitory cells are brighter and shorter.
export function mkAudio() {
  const ac = new (window.AudioContext || window.webkitAudioContext)(), out = ac.createGain(), comp = ac.createDynamicsCompressor();
  const dl = ac.createDelay(1), fb = ac.createGain(), lp = ac.createBiquadFilter();
  out.gain.value = 0.6; dl.delayTime.value = 0.27; fb.gain.value = 0.38; lp.frequency.value = 1800;
  out.connect(comp); comp.connect(ac.destination); out.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); fb.connect(comp);
  const V = [], deg = [0, 3, 5, 7, 10];
  for (let i = 0; i < 14; i++) {
    const o = ac.createOscillator(), g = ac.createGain(), p = ac.createStereoPanner ? ac.createStereoPanner() : ac.createGain();
    g.gain.value = 0; o.connect(g); g.connect(p); p.connect(out); o.start(); V.push({ o, g, p });
  }
  let k = 0, last = 0, n = 0;
  return {
    ac,
    // depth 0 (pia) to 1 (white matter), pan -1 to 1
    spike(depth, pan, inh, fibre) {
      const t = ac.currentTime; if (t !== last) { last = t; n = 0; } if (++n > 5) return;
      const v = V[k = (k + 1) % V.length], i = 14 - Math.min(14, (depth * 15) | 0), f = 98 * 2 ** ((((i / 5) | 0) * 12 + deg[i % 5]) / 12) * (inh ? 2 : 1);
      v.o.type = inh ? 'triangle' : 'sine';
      v.o.frequency.setValueAtTime(f, t);
      if (v.p.pan) v.p.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
      v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(0, t);
      v.g.gain.linearRampToValueAtTime(fibre ? 0.03 : inh ? 0.035 : 0.07, t + 0.004);
      v.g.gain.setTargetAtTime(0, t + 0.004, inh ? 0.02 : 0.06);
    },
  };
}
