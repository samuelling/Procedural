// node cont/build.mjs <outdir> : bundles the continuous world into one self-contained page and reports its size
import { build } from 'esbuild'; import fs from 'fs'; import zlib from 'zlib';
const out = process.argv[2] || 'cont/out';
const r = await build({ entryPoints: ['cont/main.js'], bundle: true, minify: true, format: 'iife', write: false, legalComments: 'none' });
let js = r.outputFiles[0].text.replace(/`([^`]*)`/g, (m, s) => m.includes('${') ? m : '`' + s.replace(/\/\/[^\n]*/g, '').replace(/\s*\n\s*/g, '\n').replace(/[ \t]+/g, ' ') + '`');
const html = fs.readFileSync('cont/page.html', 'utf8').replace('/*SCRIPT*/', () => js);
fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(out + '/index.html', html);
console.log(out + '/index.html', html.length, 'B; gzip', zlib.gzipSync(html, { level: 9 }).length, 'B');
