// The tree of life: every species on the planet as a tip of one radial tree, families as its main limbs and runs of
// close relatives as twigs, each tip coloured as its leaves. The species you have walked among are lit; the one
// under your eye is marked. Thousands of tips: the point is to see how much of the planet you have not yet met.
import { species, nSpecies } from './planet.js';

const max1 = (n) => Math.max(1, n);
export function mkLife(world) {
  const $ = (id) => document.getElementById(id), seen = new Map();   // per planet: species codes met
  const panel = $('life'), cv = $('lifecv'), ctx = cv.getContext('2d');
  let cur = null, open = false;
  const css = (c) => `rgb(${c.map((v) => Math.round(255 * Math.min(1, Math.pow(v * 1.8, 1 / 2.2)))).join(',')})`;
  function draw(G) {
    const W = cv.width = cv.clientWidth * devicePixelRatio, H = cv.height = cv.clientHeight * devicePixelRatio, cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.46;
    ctx.clearRect(0, 0, W, H); const total = max1(nSpecies(G)), S = seen.get(G.id) || new Set();
    let k = 0; ctx.lineCap = 'round';
    G.species.forEach((F, f) => {
      const a0 = k / total * Math.PI * 2, a1 = (k + F.nSp) / total * Math.PI * 2, am = (a0 + a1) / 2, r1 = R * 0.28, r2 = R * 0.62;
      ctx.strokeStyle = 'rgba(238,240,226,.35)'; ctx.lineWidth = 2 * devicePixelRatio;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(am) * r1, cy + Math.sin(am) * r1); ctx.stroke();   // the family's limb
      for (let g = 0; g < F.nSp; g += 24) {                               // twigs of two dozen relatives
        const b0 = a0 + (a1 - a0) * g / F.nSp, b1 = a0 + (a1 - a0) * Math.min(F.nSp, g + 24) / F.nSp, bm = (b0 + b1) / 2;
        ctx.strokeStyle = 'rgba(238,240,226,.18)'; ctx.lineWidth = devicePixelRatio; ctx.beginPath(); ctx.moveTo(cx + Math.cos(am) * r1, cy + Math.sin(am) * r1); ctx.lineTo(cx + Math.cos(bm) * r2, cy + Math.sin(bm) * r2); ctx.stroke();
        for (let i = g; i < Math.min(F.nSp, g + 24); i++) {
          const s = species(G, f, i), a = a0 + (a1 - a0) * (i + 0.5) / F.nSp, met = S.has(s.code), r3 = R * (met ? 1.02 : 0.94);
          ctx.strokeStyle = met ? css(s.canopy) : 'rgba(238,240,226,.13)'; ctx.lineWidth = (met ? 2.2 : 0.8) * devicePixelRatio;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(bm) * r2, cy + Math.sin(bm) * r2); ctx.lineTo(cx + Math.cos(a) * r3, cy + Math.sin(a) * r3); ctx.stroke();
          if (cur === s.code) { ctx.fillStyle = '#e8b25a'; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R * 1.07, cy + Math.sin(a) * R * 1.07, 5 * devicePixelRatio, 0, 7); ctx.fill(); }
        }
      }
      ctx.fillStyle = 'rgba(238,240,226,.75)'; ctx.font = `italic ${13 * devicePixelRatio}px Georgia, serif`; ctx.textAlign = 'center';
      ctx.fillText(F.genus, cx + Math.cos(am) * R * 0.44, cy + Math.sin(am) * R * 0.44);
      k += F.nSp;
    });
    $('lifeh').textContent = `${G.name}${G.E ? ', ' + G.ageName : ''}: ${total.toLocaleString()} tree species in ${G.species.length} families · you have met ${S.size.toLocaleString()}`;
  }
  $('lifeb').addEventListener('click', () => { open = !open; panel.hidden = !open; if (open) { document.exitPointerLock?.(); draw(world()); } });
  const shut = () => { open = false; panel.hidden = true; };
  $('lifex').addEventListener('click', shut); $('lifex2').addEventListener('click', shut);
  addEventListener('keydown', (e) => { if (open && (e.code === 'Escape' || e.code === 'KeyL')) shut(); });
  panel.addEventListener('pointerdown', (e) => { if (e.target === panel) shut(); });
  return {
    meet(G, codes) { let S = seen.get(G.id); if (!S) seen.set(G.id, S = new Set()); for (const c of codes) S.add(c); },
    count(G) { return (seen.get(G.id) || new Set()).size; },
    look(G, code) { const c = code > 0.5 ? Math.round(code) : null; if (c !== cur) { cur = c; if (open) draw(G); } return c ? species(G, Math.floor((c - 1) / 10000), (c - 1) % 10000) : null; },
    redraw(G) { if (open) draw(G); },
  };
}
