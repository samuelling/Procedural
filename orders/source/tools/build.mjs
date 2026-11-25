// node tools/build.mjs <tier> <outdir> <limit> : bundles src/ for one rung of the ladder, minifies the shaders,
// and packs the page so that it unpacks itself. TIER is a build-time constant: code for higher rungs is dropped.
import { build, transform } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const [tier, out, limit, lite] = process.argv.slice(2);   // lite 'c,e': the 200 kB rung, the whole world through coarser measurements (block sizes as in tools/pack_data.py)
const coarse = { name: 'coarse', setup(b) { b.onResolve({ filter: /^\.\/(data|kg)\.js$/ }, (a) => (lite ? { path: a.resolveDir + '/' + a.path.slice(2).replace('.js', '200.js') } : undefined)); } };
const P = String.raw` ?([{}()=+\-*/,;<>?:|&!%\[\]]) ?`;
const sq = (t) => t.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').replace(new RegExp(P, 'g'), '$1').trim();
const glsl = (body) => {                                        // one template literal of shader source
  let o = '';
  body.split('\n').forEach((line, i) => {
    const t = line.replace(/\/\/.*$/, '').trim();        // comments go line by line, before the lines are joined
    if (t[0] !== '#') { o += ' ' + t; return; }
    const m = /^#define\s+(\w+(?:\([^)]*\))?)\s+(.*)$/.exec(t);
    o = sq(o) + (i ? '\n' : '') + (m ? '#define ' + m[1] + ' ' + sq(m[2]) : t) + '\n\u0001';
  });
  return o.split('\u0001').map((s, i, a) => (i === a.length - 1 ? sq(s) : s)).join('').replace(/^(?!#)/, (x) => x);
};
// literals are joined end to end, so a space is kept where two words would meet
const shaders = { name: 'shaders', setup(b) { b.onLoad({ filter: /(gl|fx)\.js$/ }, (a) => ({ contents: readFileSync(a.path, 'utf8').replace(/`([^`]*)`/g, (_, s) => { const m = glsl(s); return '`' + (/^\s/.test(s) && /^\w/.test(m) ? ' ' : '') + m + (/\s$/.test(s) && /\w$/.test(m) ? ' ' : '') + '`'; }), loader: 'js' })); } };
const r = await build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', minifySyntax: true, minifyWhitespace: true, target: 'es2020', write: false, define: { TIER: tier, LC: lite ? lite.split(',')[0] : '0', LE: lite ? lite.split(',')[1] : '0' }, plugins: [coarse, shaders] });
// names are handed out again after the other rungs' code has been dropped, so that code written for a higher rung cannot change a lower one by a byte
const js = (await transform(r.outputFiles[0].text, { minify: true, target: 'es2020' })).code;
const html = readFileSync('src/template.html', 'utf8').replace(/<link[^>]*fonts[^>]*>\n?/, '').replace(/<script>__JS__<\/script>\n?/, '')
  .replace(/<!--T(\d)-->([^]*?)<!--\/T\d-->/g, (_, n, body) => (+tier >= +n ? body : '')).replace(/<!--L(\d)-->([^]*?)<!--\/L\d-->/g, (_, n, body) => (+tier < +n ? body : ''))   /* L: only below that rung */.replace(/\/\*[^]*?\*\//g, '').replace(/\n\s*/g, '\n').replace('__TIER__', tier)
  .replace(/<style>([^]*?)<\/style>/, (_, c) => '<style>' + c.replace(/\s*([{};:,>])\s*/g, '$1').replace(/;}/g, '}') + '</style>');   // the style sheet, squeezed
if (html.includes('__JS__')) throw new Error('template script tag not found');
writeFileSync(out + '/packed.js', 'document.open();document.write(' + JSON.stringify(html) + ');document.close();' + js);
writeFileSync(out + '/plain.html', html.replace('</body>', () => '<script>' + js.replace(/<\/script/g, '<\\/script') + '</script></body>'));
console.log(`tier ${tier}: ${js.length} B of script + ${html.length} B of page`);
execFileSync('python3', ['tools/pack.py', out + '/packed.js', out + '/index.html', limit], { stdio: 'inherit' });
