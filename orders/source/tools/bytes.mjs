// node tools/bytes.mjs : where each rung's bytes go, as a tree for the index's charts (bytes.json).
// A rung's page is an unpacker followed by one deflate stream. Each piece of what is packed is charged what it adds to
// that stream where it stands: deflated with the 32 kB before it as the dictionary, so a piece that repeats what came
// before is cheap. Those marginal costs are scaled to the stream's real length. Inside a source file the share is split
// among its top-level definitions by how big each is deflated on its own. The two smallest rungs are annotated by hand.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import zlib from 'node:zlib';

const W = 32768, enc = (s) => Buffer.from(s, 'utf8');
function charge(segs, payload) {              // segs: [{ text }] in stream order → each gets .b, scaled to payload bytes
  let ctx = Buffer.alloc(0), tot = 0;
  for (const s of segs) { const b = Buffer.isBuffer(s.text) ? s.text : enc(s.text); s.c = b.length ? zlib.deflateRawSync(b, { level: 9, dictionary: ctx.length ? ctx : undefined }).length - 2 : 0; tot += s.c; ctx = Buffer.concat([ctx, b]).subarray(-W); }
  for (const s of segs) s.b = (s.c * payload) / tot;
  return segs;
}
const boot = (file) => { const buf = readFileSync(file), n = +/slice\((\d+)\)/.exec(buf.subarray(0, 400).toString('latin1'))[1]; return { n, size: buf.length, payload: buf.length - n, text: zlib.inflateRawSync(buf.subarray(n)).toString('utf8') }; };
const js = (s) => JSON.stringify(s).slice(1, -1);
const sq = (t) => t.replace(/\/\/[^\n]*/g, '').replace(/\/\*[^]*?\*\//g, '').replace(/\s+/g, ' ');
// a source file's top-level definitions, each with the comment above it: [{ name, w }]
function parts(path) {
  const src = readFileSync(path, 'utf8'), lines = src.split('\n'), out = []; let cur = { name: '(imports and setup)', t: '' }, pend = '', tpl = false;
  const D0 = /^(?:export\s+)?(?:async\s+)?(?:function\s*\*?\s*(\w+)|(?:const|let|var|class)\s+(\w+))/, D1 = /^ {2,4}(?:(?:async\s+)?function\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*(?:\(|function|mk\w*\(|\w+\s*=>|async)|(?:get\s+)?(\w+)\s*\([^)]*\)\s*\{\s*(?:\/\/.*)?$)/;
  for (const l of lines) {
    const m = !tpl && D0.exec(l);
    if (m) { out.push(cur); cur = { name: m[1] || m[2], t: pend, sub: [] }; pend = ''; }
    else if (!tpl && cur.sub) { const n = D1.exec(l); if (n && !/^\s*(if|for|while|switch|return|catch)\b/.test(l)) cur.sub.push([cur.t.length + pend.length, n[1] || n[2] || n[3]]); }
    if (/^\s*\/\//.test(l) && !m && !tpl) pend += l + '\n'; else { cur.t += pend + l + '\n'; pend = ''; }
    if (((l.replace(/\\`/g, '').match(/`/g) || []).length) % 2) tpl = !tpl;   // inside a template literal (shader source), nothing is a definition
  }
  out.push(cur);
  const w = (t) => zlib.deflateRawSync(enc(sq(t)), { level: 9 }).length, P = out.filter((p) => p.t.trim()).map((p) => ({ ...p, w: w(p.t) })), tw = P.reduce((a, p) => a + p.w, 0);
  return P.flatMap((p) => {                                  // a factory holding most of its file is split at the definitions inside it
    if (p.w < tw * 0.35 || !p.sub || p.sub.length < 3) return [{ name: p.name, w: p.w }];
    const cuts = [[0, p.name + ' (setup)']].concat(p.sub), q = cuts.map(([i, nm], k) => ({ name: k ? p.name + ' › ' + nm : nm, t: p.t.slice(i, k + 1 < cuts.length ? cuts[k + 1][0] : p.t.length) }));
    const qw = q.map((x) => w(x.t)), qt = qw.reduce((a, b) => a + b, 0); return q.map((x, k) => ({ name: x.name, w: (p.w * qw[k]) / qt }));
  });
}
function split(node, path) {                  // children of a file's node, by its definitions; small ones gathered
  const P = parts(path), tw = P.reduce((a, p) => a + p.w, 0); if (P.length < 2) return node;
  let kids = P.map((p) => ({ name: p.name, b: (node.b * p.w) / tw })).sort((a, b) => b.b - a.b);
  const big = kids.filter((k) => k.b >= node.b * 0.02), rest = kids.filter((k) => k.b < node.b * 0.02);
  if (rest.length) big.push({ name: `${rest.length} smaller definitions`, b: rest.reduce((a, k) => a + k.b, 0) });
  node.kids = big; return node;
}
const SEC = { land: 'Land heights, every 6′ (11 km)', sea: 'Sea floor, every 24′', lake: 'Lakes: where they are', lakes: 'Lakes: their levels', clim: 'Climate: warmth, seasons, rain', gen: 'Where nine tree genera grow', moon: 'The Moon', mars: 'Mars', venus: 'Venus', mercury: 'Mercury' };
function earthSplit(node) {                   // the Earth maps by section, each charged what it adds to their deflate stream
  const E = /EARTH = '([^']*)'/.exec(readFileSync('cont/earthdata.js', 'utf8'))[1], raw = zlib.inflateRawSync(Buffer.from(E, 'base64')), n = raw.readUInt32LE(0), H = JSON.parse(raw.subarray(4, 4 + n).toString()), b0 = 4 + n;
  const S = charge(H.map((h) => ({ name: SEC[h.name] || h.name, text: raw.subarray(b0 + h.off, b0 + h.off + h.len) })), node.b);
  node.kids = S.map((x) => ({ name: x.name, b: x.b })).sort((a, b) => b.b - a.b); return node;
}
const sum = (kids) => kids.reduce((a, k) => a + k.b, 0);
const group = (name, kids, note) => ({ name, b: sum(kids), kids: kids.sort((a, b) => b.b - a.b), note });
const round = (n) => { n.b = Math.round(n.b); (n.kids || []).forEach(round); return n; };
const rung = (name, lim, file, kids) => { const used = sum(kids); kids.push({ name: 'Room left', b: lim - readFileSync(file).length, free: true }); return round({ name, b: lim, lim, used: readFileSync(file).length, kids }); };

// ---- 0.2 kB: one line, by hand
function r02() {
  const s = readFileSync('a/index.html', 'utf8').trim(), at = (a) => s.indexOf(a), seg = [];
  const cut = [['<canvas id=c width=900 height=500>', 'The canvas, 900 by 500'], ['<svg onload="', 'A hook that runs code without a script tag'],
    ['for(q=c.getContext`2d`,i=0;i<80;i++)', 'Eighty trees, far to near'], ['for(q.fillStyle=`hsl(120,15%,${90-i}%)`,', 'Green, paler the farther: the mist'],
    ['j=28;j--;)', 'Twenty-eight tiers to a tree'], ['q.fillRect(i*i*7%900-', 'Where each tree stands, scattered by its number squared'],
    ['(w=(j%4+j/4)*(s=i*i/500))/2,', 'Each tier’s width, wider down the tree and the nearer'], ['240-i+j*s,w,s)', 'Each tier’s height on the page'], ['">', 'Closing the hook']];
  let p = 0; for (const [t, nm] of cut) { const i = at(t); if (i < 0) throw new Error('0.2 kB piece not found: ' + t); seg.push({ name: nm, b: t.length }); p += t.length; }
  if (p !== s.length) seg.push({ name: 'The rest', b: s.length - p });
  return rung('0.2 kB', 200, 'a/index.html', [group('The one formula', seg.slice(2, 8)), group('The page around it', [seg[0], seg[1], seg[8]].concat(seg.slice(9)))]);
}
// ---- 2 kB: a shader, a little JavaScript, packed
function r2() {
  const B = boot('b/index.html'), g0 = readFileSync('b/forest.glsl', 'utf8');
  let g = g0.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').trim().replace(/ ?([{}()=+\-*/,;<>?:]) ?/g, '$1');
  const host = readFileSync('b/main.js', 'utf8').replace(/\n/g, ''), [h0, h1] = host.split('__GLSL__');
  // the shader by its functions (a function runs from its return type to the brace that closes it)
  const fs = [], re = /(?:^|})((?:float|vec[234]|void|mat[234])\s+(\w+)\([^)]*\)\{)/g; let m, idx = [];
  while ((m = re.exec(g))) idx.push([m.index + (g[m.index] === '}' ? 1 : 0), m[2]]);
  idx.forEach(([i, nm], k) => fs.push({ name: nm === 'main' ? 'main(): each pixel finds its tree, sky and light' : nm + '()', text: g.slice(i, k + 1 < idx.length ? idx[k + 1][0] : g.length) }));
  if (idx.length && idx[0][0] > 0) fs.unshift({ name: 'Uniforms and constants', text: g.slice(0, idx[0][0]) });
  const segs = charge([{ name: 'The host: canvas, WebGL, the frame loop', text: h0 }, ...fs, { name: 'The host (end)', text: h1 }], B.payload);
  const hostN = { name: 'The JavaScript host', b: segs[0].b + segs[segs.length - 1].b }, sh = group('The shader', segs.slice(1, -1).map((s) => ({ name: s.name, b: s.b })));
  return rung('2 kB', 2000, 'b/index.html', [sh, hostN, { name: 'The unpacker', b: B.n }]);
}
// ---- the esbuild rungs: modules from the metafile, in output order, charged in the packed stream
const FILE = { eco: 'Animals and their census', fauna: 'Drawing the animals', trees: 'Trees that grow and compete', cover: 'Grass, undergrowth and leaf litter', beaver: 'Beaver ponds', life: 'The tree of life', shade: 'Leaf shapes',
  planet: 'Terrain, climate, rivers and towns: the rules', real: 'The real Earth: its places, ages and flora', marine: 'Sea life', cave: 'Caves', fire: 'Fire', city: 'Towns', earth: 'Reading the packed maps', world: 'The invented worlds',
  micro: 'Down to quarks', cosmos: 'Out to the cosmic web', sky: 'Sky, clouds and weather overhead', wormhole: 'The wormhole', ephem: 'Where the Sun, Moon and planets are', main: 'The engine: ground, water, camera, readout',
  nav: 'Map, compass and ruler', sound: 'Sound', audio: 'Sound', grow: 'Trees grown from a genome', genome: 'Tree genomes', gl: 'Renderer and shaders', fx: 'Life, succession and evolution', noise: 'Noise',
  range: 'Mountain ranges', valley: 'Valleys', under: 'Under the lake', horizon: 'The horizon', erosion: 'Erosion', cave3: 'Caves' };
const NAMES = { 'earthdata.js': 'Earth maps: heights, sea floor, climate, lakes, tree ranges', 'patchdata.js': 'Measured close-up terrain at the Go-to places', 'lightdata.js': 'Night lights', 'stardata.js': 'Stars (HYG catalogue)', 'riverdata.js': 'Rivers (Natural Earth)', 'data.js': 'Earth maps', 'data200.js': 'Earth maps, coarse', 'kg.js': 'Climate zones', 'kg200.js': 'Climate zones, coarse' };
const GROUPS = [['Measured data', ['earthdata', 'patchdata', 'lightdata', 'stardata', 'riverdata', 'data', 'data200', 'kg', 'kg200']],
  ['The living world', ['eco', 'fauna', 'trees', 'cover', 'life', 'shade', 'grow', 'genome', 'beaver', 'fx']],
  ['Ground, water, towns and weather', ['planet', 'earth', 'real', 'marine', 'cave', 'cave3', 'fire', 'city', 'erosion', 'world', 'range', 'valley', 'under', 'horizon']],
  ['Sky, space and the very small', ['sky', 'cosmos', 'micro', 'ephem', 'wormhole']],
  ['The engine: drawing, moving, the readout', ['main', 'gl', 'noise']], ['Map, compass and sound', ['nav', 'sound', 'audio']]];
async function esb(opts, segText) {
  const r = await build({ ...opts, write: false, metafile: true });
  const out = Object.values(r.metafile.outputs)[0], ins = Object.entries(out.inputs).filter(([, v]) => v.bytesInOutput > 0), text = r.outputFiles[0].text;
  let p = 0; const segs = ins.map(([path, v]) => { const t = text.slice(p, p + v.bytesInOutput); p += v.bytesInOutput; return { path, text: segText ? segText(t) : t }; });
  return { segs, rest: text.slice(p), text };
}
function tree(name, lim, file, segs, extra) {
  const files = {};
  for (const s of segs) { const k = s.path || s.name; const fn = k.split('/').pop(), bn = fn.replace(/\.js$/, ''); files[k] = files[k] || { name: s.name || NAMES[fn] || (FILE[bn] ? `${FILE[bn]} (${fn})` : fn), path: s.path, b: 0 }; files[k].b += s.b; }
  const fl = Object.values(files).map((f) => (/earthdata\.js$/.test(f.path || '') ? earthSplit(f) : f.path && /\.js$/.test(f.path) && !/data\d*\.js$|kg\d*\.js$/.test(f.path) ? split(f, f.path) : f));
  const base = (f) => f.path && f.path.split('/').pop().replace(/\.js$/, ''), groups = GROUPS.map(([g, L]) => group(g, fl.filter((f) => L.includes(base(f)) && !f.taken && (f.taken = 1)))).filter((g) => g.kids.length);
  const left = fl.filter((f) => !f.taken).map((f) => (/fflate/.test(f.path || '') ? { ...f, name: 'Inflating the packed maps (fflate)', kids: undefined } : f)); if (left.length) groups.push(group('The page and its unpackers', left.concat(extra)));
  groups.forEach((g) => g.kids.forEach((k) => delete k.taken));
  if (!left.length) groups.push(group('The page and its unpackers', extra));
  return rung(name, lim, file, groups);
}
async function r2mb() {
  const B = boot('w/index.html');
  const sqz = (t) => t.replace(/`([^`]*)`/g, (m, s) => (m.includes('${') ? m : '`' + s.replace(/\/\/[^\n]*/g, '').replace(/\s*\n\s*/g, '\n').replace(/[ \t]+/g, ' ') + '`'));
  const { segs, rest } = await esb({ entryPoints: ['cont/main.js'], bundle: true, minify: true, format: 'iife', legalComments: 'none' });
  const page = readFileSync('cont/page.html', 'utf8').split('/*SCRIPT*/');
  const all = [{ name: 'The page: layout, styles, controls', text: 'document.open();document.write("' + js(page[0]) }, ...segs.map((s) => ({ path: s.path, text: js(sqz(s.text)) })), { name: 'The page: layout, styles, controls', text: js(rest + page[1]) + '");document.close();' }];
  charge(all, B.payload);
  return tree('2 MB', 2000000, 'w/index.html', all, [{ name: 'The unpacker', b: B.n }]);
}
async function rTier(name, lim, dir, tier, lite) {
  const B = boot(dir + '/index.html');
  const coarse = { name: 'coarse', setup(b) { b.onResolve({ filter: /^\.\/(data|kg)\.js$/ }, (a) => (lite ? { path: a.resolveDir + '/' + a.path.slice(2).replace('.js', '200.js') } : undefined)); } };
  const { segs, rest } = await esb({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', minifySyntax: true, minifyWhitespace: true, target: 'es2020', define: { TIER: tier, LC: lite ? lite.split(',')[0] : '0', LE: lite ? lite.split(',')[1] : '0' }, plugins: [coarse] });
  const pg = B.text.slice(0, B.text.indexOf(');document.close();') + 19);   // the page, as written in the stream
  const all = [{ name: 'The page: layout, styles, controls', text: pg }, ...segs.map((s) => ({ path: s.path, text: s.text })), { name: 'The page: layout, styles, controls', text: rest }];
  charge(all, B.payload);
  return tree(name, lim, dir + '/index.html', all, [{ name: 'The unpacker', b: B.n }]);
}
const T = { '0.2kb': r02(), '2kb': r2(), '20kb': await rTier('20 kB', 20000, 'c', '2'), '200kb': await rTier('200 kB', 200000, 'd', '4', '6,6'), '2mb': await r2mb() };
writeFileSync('bytes.json', JSON.stringify(T));
for (const [k, t] of Object.entries(T)) console.log(k, t.used, 'of', t.lim, '|', t.kids.map((g) => `${g.name} ${g.b}`).join(' · '));
