// Bundles src/ into one self-contained index.html. `node build.mjs --readable` keeps the script unminified.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const r = await build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: !process.argv.includes('--readable'), target: 'es2020', write: false });
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const html = readFileSync('template.html', 'utf8').replace('__JS__', () => js);
writeFileSync('index.html', html);
console.log(`index.html: ${(html.length / 1024).toFixed(1)} kB, ${(gzipSync(html).length / 1024).toFixed(1)} kB gzipped`);
