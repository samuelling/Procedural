// node tools/patchbase.mjs in.json out.bin : the page's own 6' ground (bicubic, clamped as the page clamps it) at each
// [lat, lon] (degrees) in in.json, as float64; the patches store the measured 15" ground less this
import { earth } from '../cont/earth.js';
import fs from 'fs';
const pts = JSON.parse(fs.readFileSync(process.argv[2])), g = earth().g, R = Math.PI / 180, out = new Float64Array(pts.length);
pts.forEach(([la, lo], k) => { out[k] = g.cubicC([Math.cos(la * R) * Math.cos(lo * R), Math.cos(la * R) * Math.sin(lo * R), Math.sin(la * R)]); });
fs.writeFileSync(process.argv[3], Buffer.from(out.buffer));
