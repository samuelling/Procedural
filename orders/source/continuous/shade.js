// Surfaces shared by more than one kind of thing: a leaf's face (on the tree and in the litter), as it looks at every
// scale, from a green patch to its veins to its cells and stomata.
export const VOR = `
float vor2(vec2 u, out vec2 c) { vec2 i = floor(u), f = u - i; float d = 9., d2 = 9.; c = vec2(0.); for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(x, y), r = o + vec2(h1(i + o), h1(i + o + 7.3)) * .8 + .1 - f; float e = dot(r, r); if (e < d) { d2 = d; d = e; c = r; } else if (e < d2) d2 = e; } return sqrt(d2) - sqrt(d); }
`;
// lp: metres from the leaf's base along it (x) and across it (y); ll: its length; fp: how much a pixel covers there
export const LEAFFACE = VOR + `
vec3 leafFace(vec3 alb, vec2 lp, float ll, float fp) {
  float mid = smoothstep(.0011, .0004, abs(lp.y)) * smoothstep(1.5e-3, 4e-4, fp);                       // the midrib
  float sv = abs(fract((lp.x - abs(lp.y) * 1.2) / (ll * .12)) - .5) * ll * .12, side = smoothstep(.0006, .0002, sv) * smoothstep(8e-4, 2e-4, fp);   // side veins
  vec2 cc; float net = vor2(lp / .0012, cc), tert = smoothstep(.08, .02, net) * smoothstep(2.5e-4, 8e-5, fp);   // the fine net between them
  alb = mix(alb, alb * 1.45 + .015, max(mid, max(side * .8, tert * .5)));
  if (fp < 2e-5) {                                                         // the epidermis: jigsaw cells about 40 micrometres across
    vec2 c2, wq = lp / 4e-5 + vec2(n2(lp / 2e-5), n2(lp / 2e-5 + 5.)) * .35; float e = vor2(wq, c2), k = smoothstep(2e-5, 4e-6, fp);
    alb = mix(alb, alb * (.85 + .25 * smoothstep(.03, .12, e)) - .02 * smoothstep(.04, .0, e), k);
    vec2 sc; vor2(lp / 1.1e-4 + 17.3, sc); float st = step(.78, h1(floor(lp / 1.1e-4 + 17.3 + sc)));   // and stomata scattered among them
    vec2 g = sc * vec2(1., 1.6); float gd = length(g), guard = smoothstep(.22, .18, gd) * smoothstep(.04, .07, abs(g.x)), pore = smoothstep(.06, .03, abs(g.x)) * smoothstep(.2, .15, gd);
    alb = mix(alb, alb * 1.25 + vec3(.01, .02, 0.), guard * st * k); alb = mix(alb, alb * .25, pore * st * k * smoothstep(1e-5, 3e-6, fp));
  }
  return alb;
}`;
