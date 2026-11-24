// node tools/build.mjs <tier> <outdir> <limit> : bundles src/ for one rung of the ladder, minifies the shaders,
// and packs the page so that it unpacks itself. TIER is a build-time constant: code for higher rungs is dropped.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const [tier, out, limit] = process.argv.slice(2);
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
const shaders = { name: 'shaders', setup(b) { b.onLoad({ filter: /(gl|fx)\.js$/ }, (a) => ({ contents: readFileSync(a.path, 'utf8').replace(/`([^`]*)`/g, (_, s) => '`' + glsl(s) + '`'), loader: 'js' })); } };
const r = await build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: true, target: 'es2020', write: false, define: { TIER: tier }, plugins: [shaders] });
const js = r.outputFiles[0].text;
const html = readFileSync('src/template.html', 'utf8').replace(/<link[^>]*fonts[^>]*>\n?/, '').replace(/<script>__JS__<\/script>\n?/, '')
  .replace(/\/\*[^]*?\*\//g, '').replace(/\n\s*/g, '\n').replace('__TIER__', tier);
if (html.includes('__JS__')) throw new Error('template script tag not found');
writeFileSync(out + '/packed.js', 'document.open();document.write(' + JSON.stringify(html) + ');document.close();' + js);
writeFileSync(out + '/plain.html', html.replace('</body>', () => '<script>' + js.replace(/<\/script/g, '<\\/script') + '</script></body>'));
console.log(`tier ${tier}: ${js.length} B of script + ${html.length} B of page`);
execFileSync('python3', ['tools/pack.py', out + '/packed.js', out + '/index.html', limit], { stdio: 'inherit' });
