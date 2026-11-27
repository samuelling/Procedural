// The living world near you, kept as numbers that answer to each other. Nothing here is scripted: a birth, a hunt,
// a starved winter, a sapling getting its chance in a gap: each happens when the numbers bring it about.
//
// Animals. Each 1 km square of open country (a "range") keeps two food chains: a herd of large grazers and their
// hunters, and in a 10-hectare plot of it, hares (or rabbits, or maras) and the foxes, lynx or jackals that live on
// them. Every animal is an individual: named, female or male, born in spring to two living parents, ageing, and dying
// of age, of hunger in a bad year, of cold, or to the hunters. Each carries four genes from both parents with a little
// change: its size, its speed, its wariness and its coat. Selection is not written in, it falls out of the bookkeeping:
// the hunters catch the slow, the young and the old; big bodies hold heat in a cold winter but starve first when the
// grass is short; the wary are caught less but feed less, so raise fewer young; speed costs condition. The coat does
// nothing, so it only drifts. The hunters live by their kills: well fed they raise young, hungry they starve, they
// leave country that has run out of prey and come into country where it has grown; their speed is inherited too.
// Under them, the plants and the small things: grass that grows back with rain and warmth and is shared by both
// chains of grazers and by the insects; insects that eat grass and leaves; birds that eat the insects. Each is a pool
// for the square, so a summer of insects means more birds (and more birdsong). Where the hunters have killed, the
// herd keeps away for a year or two, so the seedlings there escape browsing (see the stands). In the soil, springtails
// eat the fungi on the litter and predatory mites eat the springtails: the microscope reads their numbers.
//
// Plants. Near you every tree is an individual (stands of 16 x 16 tree sites, 112 m across): it grows by the light
// that reaches it past taller neighbours and the water it gets in competition with every crown near it, and by its
// kind (a beech or fir grows on in shade where a birch or pine gives up); trees that cannot keep up die, stand as
// snags and fall; mature trees seed the ground round them, and a seed takes where there is light, water and room, and
// where the grazers do not eat it first. Fire and insect years feed into the same sums.
//
// The numbers are from field studies where there are some (see DATA.md): densities per km², kills per predator per
// year, litter sizes, lifespans. The dynamics are the textbook ones (logistic regrowth, a kill rate that levels off as
// prey get common, a predator's young in proportion to how well it fed), so the cycles they make (hares and lynx
// rising and falling years apart, wolves knocking an elk herd down and then thinning out) are the model's, not
// recordings. Away from you nothing is computed; come back and the years you were gone are caught up. What you have
// seen is kept in this browser between visits.
import { AX, H, hs2, climate, forestF, cityRho, citySuit, river, lakeAt, site, siteP } from './planet.js';

const { floor, max, min, abs, hypot, sin, cos, sqrt, exp, atan2, PI } = Math, rnd = Math.random;
const rr = (a, b) => a + (b - a) * rnd(), cl = (v, a = 0, b = 1) => min(b, max(a, v)), gs = () => sqrt(-2 * Math.log(1 - rnd())) * cos(2 * PI * rnd());
export const HS = 1000, PATCH = 16, TREE = 7, PLOT = 0.1;   // PLOT: the small chain's plot, km²
const NM1 = 'Al Bri Ca Da El Fa Ha Is Ka Li Mo Ne Or Ra Sa Ta Ur Va Wy Yo'.split(' '), NM2 = 'ba da ra na la ric wen mund ka so li th gar ne ya ro'.split(' ');

// ---- who lives where. A kind: name, plural, young, [female, male], lifespan (years), age of maturity, young a year,
// size (a red deer is 1; mass goes as its cube), neck, body length, leg, coat, running speed (m/s), and: form (its
// build, fauna.js), dens (head per km² in good country), for hunters grp (how many keep together), need (kills a year
// of prey of mass m0), mort (a year's other deaths: fights, accidents) ----------------------------------------------
const A = (nm, pl, yg, sx, life, mat, lit, sz, neck, len, L, col, run, more = {}) => ({ nm, pl, yg, sx, life, mat, lit, sz, neck, len, L, col, run, grp: 0, need: 0, m0: 1, mort: 0.03, dens: 10, ...more });
const deer = (o) => ({ form: 'deer', ...o });
const G_ = {
  red: A('red deer', 'red deer', 'calf', ['hind', 'stag'], 15, 2, 0.65, 1, 0.55, 1.1, 1, [0.36, 0.19, 0.09], 13, deer({ dens: 10 })),   // 5–15 per km², 60–70 calves per 100 hinds (Scotland)
  wtd: A('white-tailed deer', 'white-tailed deer', 'fawn', ['doe', 'buck'], 10, 1.5, 1.6, 0.85, 0.5, 1, 1, [0.4, 0.25, 0.13], 13, deer({ dens: 10 })),
  mule: A('mule deer', 'mule deer', 'fawn', ['doe', 'buck'], 10, 1.5, 1.6, 0.9, 0.5, 1.05, 1, [0.45, 0.38, 0.3], 13, deer({ dens: 2 })),   // the deserts' deer: 1–3 per km²
  elk: A('elk', 'elk', 'calf', ['cow', 'bull'], 15, 2, 0.6, 1.3, 0.55, 1.2, 1.05, [0.42, 0.3, 0.18], 13, deer({ dens: 5, ant: 1.6 })),   // northern Yellowstone, ~5 per km²
  bison: A('bison', 'bison', 'calf', ['cow', 'bull'], 20, 3, 0.7, 1.7, 0.25, 1.4, 0.75, [0.15, 0.09, 0.05], 15, { form: 'bison', dens: 8 }),
  cari: A('caribou', 'caribou', 'calf', ['cow', 'bull'], 15, 2, 0.7, 1.05, 0.45, 1.1, 1, [0.34, 0.3, 0.26], 15, deer({ dens: 2, both: 1, ant: 1.3 })),
  rein: A('reindeer', 'reindeer', 'calf', ['cow', 'bull'], 15, 2, 0.7, 1, 0.45, 1.1, 0.95, [0.36, 0.32, 0.28], 15, deer({ dens: 3, both: 1, ant: 1.2 })),
  musk: A('musk ox', 'musk oxen', 'calf', ['cow', 'bull'], 20, 3, 0.6, 1.3, 0.2, 1.2, 0.6, [0.1, 0.07, 0.05], 11, { form: 'musk', dens: 0.5 }),
  gnu: A('wildebeest', 'wildebeest', 'calf', ['cow', 'bull'], 20, 2, 0.8, 1.15, 0.45, 1.2, 1, [0.17, 0.15, 0.13], 20, { form: 'gnu', dens: 50 }),
  guan: A('guanaco', 'guanacos', 'chulengo', ['female', 'male'], 20, 2, 0.7, 1, 1.3, 1, 1.1, [0.56, 0.38, 0.22], 15, { form: 'camel', dens: 5 }),
  brock: A('red brocket', 'red brockets', 'fawn', ['doe', 'buck'], 12, 1.5, 1, 0.6, 0.4, 0.9, 0.85, [0.45, 0.2, 0.08], 12, deer({ dens: 3, ant: 0.4 })),
  saiga: A('saiga', 'saiga', 'calf', ['female', 'male'], 10, 1, 1.6, 0.65, 0.35, 0.95, 0.9, [0.62, 0.5, 0.35], 20, { form: 'saiga', dens: 5 }),
  chit: A('chital', 'chital', 'fawn', ['doe', 'stag'], 12, 1.5, 0.9, 0.8, 0.5, 1, 1, [0.52, 0.28, 0.11], 18, deer({ spots: 1, dens: 30 })),
  sika: A('sika deer', 'sika deer', 'fawn', ['hind', 'stag'], 15, 1.5, 0.8, 0.75, 0.5, 1, 0.95, [0.4, 0.24, 0.12], 13, deer({ spots: 1, dens: 15 })),
  roo: A('red kangaroo', 'red kangaroos', 'joey', ['doe', 'boomer'], 15, 2, 1, 0.85, 0.5, 0.9, 1.1, [0.55, 0.3, 0.17], 15, { form: 'roo', dens: 10 }),
  mam: A('woolly mammoth', 'woolly mammoths', 'calf', ['cow', 'bull'], 60, 12, 0.25, 2.6, 0.3, 1.3, 0.9, [0.24, 0.13, 0.06], 10, { form: 'mammoth', dens: 0.5 }),
  hipp: A('Hipparion', 'Hipparion', 'foal', ['mare', 'stallion'], 20, 2, 0.8, 1, 0.65, 1.1, 1.05, [0.45, 0.35, 0.24], 16, { form: 'horse', dens: 10 }),
  eoh: A('dawn horse', 'dawn horses', 'foal', ['mare', 'stallion'], 8, 1, 1, 0.4, 0.4, 1, 0.9, [0.36, 0.25, 0.14], 9, { form: 'horse', dens: 20 }),
  saur: A('sauropod', 'sauropods', 'hatchling', ['female', 'male'], 70, 15, 3, 4, 2.6, 1.6, 0.9, [0.3, 0.3, 0.25], 5, { form: 'sauropod', dens: 0.3 }),
  arth: A('Arthropleura', 'Arthropleura', 'juvenile', ['female', 'male'], 6, 1.5, 3, 1, 0.01, 2.4, 0.3, [0.18, 0.07, 0.04], 1, { form: 'millipede', dens: 20 }),
  any: A('grazer', 'grazers', 'calf', ['female', 'male'], 12, 2, 1, 1, 0.5, 1, 1, null, 13),
};
const cat = (o) => ({ form: 'cat', ...o }), dog = (o) => ({ form: 'canid', ...o });
const H_ = {   // need/m0: wolves 18–22 elk a year each (Yellowstone); lions about 15 large prey; cougars about a deer a week
  wolf: A('grey wolf', 'wolves', 'pup', ['she-wolf', 'wolf'], 10, 2, 5, 0.8, 0.15, 1, 1, [0.24, 0.22, 0.2], 14, dog({ grp: 10, need: 20, m0: 2.2, dens: 0.05, mort: 0.18 })),   // 53 per 1000 km², packs ~10, most die by 5
  lion: A('lion', 'lions', 'cub', ['lioness', 'lion'], 14, 3, 3, 1.1, 0.15, 1.1, 1, [0.6, 0.45, 0.25], 19, cat({ grp: 6, need: 15, m0: 1.5, dens: 0.14, mort: 0.1, mane: 1 })),   // 0.14 per km² by the Serengeti
  puma: A('cougar', 'cougars', 'kitten', ['female', 'male'], 12, 2.5, 2.5, 0.8, 0.15, 1.05, 0.95, [0.55, 0.42, 0.28], 18, cat({ grp: 1, need: 45, m0: 0.6, dens: 0.02, mort: 0.1 })),   // 1.7–2.5 per 100 km²
  jag: A('jaguar', 'jaguars', 'cub', ['female', 'male'], 12, 3, 2, 0.85, 0.15, 1.05, 0.9, [0.62, 0.45, 0.18], 18, cat({ grp: 1, need: 40, m0: 0.3, dens: 0.03, spots: 3 })),
  tiger: A('tiger', 'tigers', 'cub', ['tigress', 'tiger'], 14, 3.5, 3, 1.15, 0.15, 1.15, 1, [0.7, 0.38, 0.12], 17, cat({ grp: 1, need: 50, m0: 0.6, dens: 0.03, spots: 2 })),
  dingo: A('dingo', 'dingoes', 'pup', ['female', 'male'], 9, 1.5, 5, 0.6, 0.15, 0.95, 1, [0.66, 0.45, 0.25], 15, dog({ grp: 4, need: 30, m0: 0.5, dens: 0.1, mort: 0.15 })),
  clion: A('cave lion', 'cave lions', 'cub', ['lioness', 'lion'], 14, 3, 2.5, 1.2, 0.15, 1.1, 1, [0.6, 0.5, 0.35], 17, cat({ grp: 5, need: 15, m0: 2, dens: 0.05 })),
  homo: A('Homotherium', 'Homotherium', 'cub', ['female', 'male'], 14, 3, 2.5, 1, 0.15, 1.05, 1.05, [0.55, 0.43, 0.3], 16, cat({ grp: 4, need: 15, m0: 1, dens: 0.05 })),
  hyd: A('hyaenodont', 'hyaenodonts', 'pup', ['female', 'male'], 10, 1.5, 3, 0.5, 0.15, 1, 0.9, [0.3, 0.25, 0.2], 9, dog({ grp: 2, need: 30, m0: 0.1, dens: 0.1 })),
  allo: A('Allosaurus', 'Allosaurus', 'hatchling', ['female', 'male'], 25, 10, 6, 2.2, 0.3, 1.3, 1.1, [0.32, 0.28, 0.2], 9, { form: 'theropod', grp: 2, need: 4, m0: 30, dens: 0.01 }),
  any: A('hunter', 'hunters', 'young', ['female', 'male'], 10, 2, 4, 0.8, 0.15, 1, 1, null, 14, dog({ grp: 5, need: 15, m0: 1, dens: 0.05 })),
};
// the small chain: hares and their hunters (snowshoe hares 0.2 to 15 per hectare over the cycle, up to 16–18 young a
// summer at the peak; a lynx kills 0.3–1.2 hares a day, a coyote 0.3–2.3: Kluane, Yukon)
const hare = (o) => ({ form: 'hare', ...o });
const S_ = {
  snow: A('snowshoe hare', 'snowshoe hares', 'leveret', ['doe', 'buck'], 5, 0.9, 8, 0.33, 0.3, 0.6, 0.8, [0.42, 0.33, 0.24], 13, hare({ dens: 100 })),
  arch: A('Arctic hare', 'Arctic hares', 'leveret', ['doe', 'buck'], 5, 1, 5, 0.38, 0.3, 0.6, 0.8, [0.7, 0.7, 0.68], 15, hare({ dens: 10 })),
  eur: A('European hare', 'European hares', 'leveret', ['doe', 'buck'], 6, 0.8, 7, 0.38, 0.3, 0.6, 0.85, [0.45, 0.33, 0.2], 18, hare({ dens: 30 })),
  mtn: A('mountain hare', 'mountain hares', 'leveret', ['doe', 'buck'], 6, 0.9, 5, 0.35, 0.3, 0.6, 0.8, [0.45, 0.4, 0.34], 15, hare({ dens: 20 })),
  cot: A('eastern cottontail', 'eastern cottontails', 'kit', ['doe', 'buck'], 3, 0.5, 12, 0.28, 0.3, 0.55, 0.65, [0.42, 0.34, 0.25], 12, hare({ dens: 150 })),
  jack: A('black-tailed jackrabbit', 'black-tailed jackrabbits', 'leveret', ['doe', 'buck'], 5, 0.7, 6, 0.36, 0.3, 0.6, 0.85, [0.5, 0.42, 0.32], 18, hare({ dens: 50 })),
  scrub: A('scrub hare', 'scrub hares', 'leveret', ['doe', 'buck'], 5, 0.8, 6, 0.33, 0.3, 0.6, 0.8, [0.5, 0.42, 0.32], 16, hare({ dens: 30 })),
  rab: A('European rabbit', 'European rabbits', 'kit', ['doe', 'buck'], 3, 0.5, 15, 0.26, 0.3, 0.55, 0.6, [0.46, 0.38, 0.28], 11, hare({ dens: 300 })),
  mara: A('Patagonian mara', 'Patagonian maras', 'pup', ['female', 'male'], 8, 0.7, 2, 0.45, 0.35, 0.7, 1.1, [0.5, 0.4, 0.3], 13, hare({ dens: 10 })),
  agou: A('agouti', 'agoutis', 'pup', ['female', 'male'], 8, 0.8, 3, 0.33, 0.25, 0.65, 0.8, [0.48, 0.3, 0.15], 10, hare({ dens: 30 })),
  ind: A('Indian hare', 'Indian hares', 'leveret', ['doe', 'buck'], 5, 0.8, 5, 0.33, 0.3, 0.6, 0.8, [0.5, 0.38, 0.26], 16, hare({ dens: 30 })),
  tol: A('Tolai hare', 'Tolai hares', 'leveret', ['doe', 'buck'], 5, 0.8, 5, 0.33, 0.3, 0.6, 0.8, [0.58, 0.48, 0.34], 17, hare({ dens: 20 })),
  jph: A('Japanese hare', 'Japanese hares', 'leveret', ['doe', 'buck'], 5, 0.8, 5, 0.33, 0.3, 0.6, 0.8, [0.44, 0.33, 0.22], 15, hare({ dens: 20 })),
};
const s_ = {
  lynx: A('Canada lynx', 'Canada lynx', 'kitten', ['female', 'male'], 12, 2, 3, 0.45, 0.15, 0.85, 1.1, [0.5, 0.45, 0.38], 14, cat({ grp: 1, need: 250, m0: 0.036, dens: 0.2, mort: 0.15 })),
  afox: A('Arctic fox', 'Arctic foxes', 'kit', ['vixen', 'fox'], 5, 1, 6, 0.3, 0.15, 0.9, 0.7, [0.75, 0.74, 0.72], 13, dog({ grp: 2, need: 60, m0: 0.036, dens: 0.3, mort: 0.25 })),
  fox: A('red fox', 'red foxes', 'kit', ['vixen', 'fox'], 5, 1, 4.5, 0.3, 0.15, 0.9, 0.75, [0.62, 0.3, 0.12], 13, dog({ grp: 2, need: 60, m0: 0.036, dens: 1, mort: 0.3 })),
  coy: A('coyote', 'coyotes', 'pup', ['female', 'male'], 8, 1, 5, 0.45, 0.15, 0.95, 0.9, [0.5, 0.42, 0.32], 16, dog({ grp: 3, need: 200, m0: 0.036, dens: 0.3, mort: 0.25 })),
  jack: A('black-backed jackal', 'black-backed jackals', 'pup', ['female', 'male'], 8, 1, 4, 0.33, 0.15, 0.9, 0.85, [0.48, 0.36, 0.24], 15, dog({ grp: 2, need: 60, m0: 0.036, dens: 0.5, mort: 0.2 })),
  gjack: A('golden jackal', 'golden jackals', 'pup', ['female', 'male'], 8, 1, 4, 0.33, 0.15, 0.9, 0.85, [0.6, 0.48, 0.3], 15, dog({ grp: 2, need: 60, m0: 0.036, dens: 0.5, mort: 0.2 })),
  pfox: A('pampas fox', 'pampas foxes', 'kit', ['vixen', 'fox'], 8, 1, 4, 0.3, 0.15, 0.9, 0.8, [0.45, 0.42, 0.38], 13, dog({ grp: 2, need: 40, m0: 0.1, dens: 0.5, mort: 0.2 })),
  oce: A('ocelot', 'ocelots', 'kitten', ['female', 'male'], 12, 2, 1.5, 0.4, 0.15, 0.95, 0.8, [0.62, 0.5, 0.3], 12, cat({ grp: 1, need: 60, m0: 0.04, dens: 0.3, spots: 3 })),
  cors: A('corsac fox', 'corsac foxes', 'kit', ['vixen', 'fox'], 6, 1, 5, 0.28, 0.15, 0.85, 0.75, [0.6, 0.52, 0.4], 13, dog({ grp: 2, need: 50, m0: 0.036, dens: 0.3, mort: 0.25 })),
};
// the birds' hunters, the fresh water's chain (its insects, fish, and the otters and herons that take the fish), and
// the sea's (plankton, small fish, their hunters, the whales), named by place and age
const heron = (nm) => A(nm, nm + 's', 'chick', ['female', 'male'], 15, 2, 3, 0.6, 1, 0.7, 1.3, [0.5, 0.52, 0.55], 6, { form: 'heron' });
function waters(G, la, lo, T) {
  const E = G.E || 0, In = (a, b, c, d) => la >= a && la <= b && lo >= c && lo <= d;
  if (!G.real) return { hawk: 'hawk', fish: 'fish', top: 'otter', heron: heron('heron'), pred: 'hunting fish', whale: 'whales' };
  if (E >= 385) return { hawk: null, fish: E >= 450 ? 'jawless fish' : 'lobe-finned fish', top: null, heron: null, pred: E >= 450 ? 'sea scorpions' : 'Dunkleosteus', whale: null };
  if (E >= 310) return { hawk: null, birds: 'giant dragonflies', fish: 'lungfish', top: null, heron: null, pred: 'Stethacanthus sharks', whale: null };
  if (E >= 150) return { hawk: 'pterosaur', birds: 'early birds and pterosaurs', fish: 'ray-finned fish', top: null, heron: null, pred: 'plesiosaurs and ichthyosaurs', whale: null };
  if (E >= 50) return { hawk: 'early hawk', fish: 'fish', top: null, heron: heron('heron'), pred: 'early whales and sharks', whale: null };
  const cold = abs(la) > 45, warm = T > 18, na = In(15, 75, -170, -50), eu = In(34, 72, -12, 42), af = In(-36, 36, -20, 52), au = In(-45, -10, 112, 155), sa = In(-56, 15, -120, -30), as = In(-12, 56, 42, 150);
  return {
    hawk: na ? (cold ? 'northern goshawk' : 'Cooper’s hawk') : eu ? 'Eurasian sparrowhawk' : af ? 'African goshawk' : au ? 'brown goshawk' : sa ? 'roadside hawk' : as ? (warm ? 'shikra' : 'Japanese sparrowhawk') : 'sparrowhawk',
    fish: warm ? (af ? 'tilapia' : sa ? 'piranhas' : au ? 'Murray cod' : 'catfish') : na ? 'brook trout' : 'brown trout',
    top: au ? 'platypus' : af ? 'African clawless otter' : sa ? 'giant otter' : na ? 'North American river otter' : 'Eurasian otter',
    heron: heron(na ? 'great blue heron' : af ? 'goliath heron' : au ? 'white-faced heron' : sa ? 'cocoi heron' : 'grey heron'),
    pred: abs(la) > 50 ? 'seals' : warm ? 'reef sharks' : 'dolphins', whale: abs(la) > 50 ? 'humpback whales' : warm ? 'humpback whales' : 'fin whales' };
}
// who else lives on a hectare here, class by class: a count per hectare for each, anchored to field censuses and
// scaled by climate the way each class is known to go (see DATA.md): ants with warmth, peaking in the tropics;
// earthworms with cool damp soil, peaking in the temperate zone; amphibians with wet, productive, shaded ground (the
// lungless salamanders of eastern North American forests most of all); reptiles with heat and dryness; birds and small
// mammals with what the land grows; bats sparser than any of them. Insect-eaters follow the insect pool; the age decides
// who exists yet. The masses (fresh weight, grams) give the weights by class.
const CM = { ant: 0.002, worm: 0.3, amph: 0.6, rept: 6, snake: 60, rod: 22, bird: 25, bat: 12 };
function census(G, R, la, lo) {
  if (G.real !== 'earth') return null;
  const E = G.E || 0, T = R.T, wet = cl(R.W * 1.4), hot = cl((T + 2) / 27), bare = cl(0.1 + R.prod * 8), In = (a, b, c, d) => la >= a && la <= b && lo >= c && lo <= d;
  const mg = In(-26, -12, 43, 51), na = In(15, 75, -170, -50), eu = In(34, 72, -12, 42), af = !mg && In(-36, 36, -20, 52), au = In(-45, -10, 112, 155), sa = In(-56, 15, -120, -30), as = !mg && !na && !eu && !af && !au && !sa;
  const trop = abs(la) < 23 && T > 20, arid = R.W < 0.3, cold = T < 2, east = na && lo > -95 && la < 50 && la > 30 && R.W > 0.45;
  const age = (a) => (E < a ? 1 : 0), pick = (...o) => o.find((x) => x) || null;
  const c = {
    ant: T < -4 ? 0 : 1e4 * (30 + 900 * cl(T / 26) ** 2 * (0.5 + 0.5 * wet)) * (0.25 + 0.75 * cl(R.prod * 2.5)) * (E < 50 ? 1 : E < 100 ? 0.1 : 0),
    worm: 1e4 * 250 * cl((R.W - 0.25) * 2) * Math.exp(-(((T - 9) / 13) ** 2)) * cl((T + 4) / 6),   // none in frozen ground
    amph: T < -9 ? 0 : 5000 * wet ** 2 * (0.25 + 0.75 * R.fF) * cl((T + 4) / 14) * (east ? 2.5 : 1) * age(370),
    rept: 250 * hot ** 2 * (1.25 - 0.7 * wet) * bare * age(310), rod: (5 + 40 * R.prod * (0.6 + 0.4 * (1 - R.fF))) * age(200),
    bird: 1.2 + 12 * R.prod * (0.7 + 0.3 * R.fF), bat: T < -3 ? 0 : (0.2 + 2.5 * cl((T + 2) / 26) ** 2 * (0.4 + 0.6 * R.fF)) * age(52) };
  const ub = cl((R.urb || 0) * 2.5); c.amph *= 1 - 0.99 * ub; c.rept *= 1 - 0.95 * ub; c.worm *= 1 - 0.8 * ub; c.ant *= 1 - 0.5 * ub;   // paved and built over
  c.snake = c.rept * 0.08; if (E >= 150) c.bird = 0;
  const N = E > 0 ? { ant: 'ants', worm: 'earthworms', amph: E > 250 ? 'early amphibians' : 'frogs and salamanders', rept: E > 66 ? 'small reptiles' : 'lizards', snake: 'snakes', rod: E > 56 ? 'small early mammals' : 'mice and shrews', bird: 'birds', bat: 'bats' } : {
    ant: pick(mg && 'ants', sa && trop && 'leafcutter and army ants', af && trop && 'driver ants', (as || au) && trop && 'weaver ants', arid && 'harvester ants', eu && 'red wood and garden ants', 'ants'),
    worm: 'earthworms',
    amph: pick(mg && 'mantella and other Malagasy frogs', east && 'red-backed salamanders', na && arid && 'spadefoot toads', na && lo < -115 && 'Pacific tree frogs', na && 'wood frogs', eu && (T < 11 ? 'common frogs' : 'green toads'), af && (arid ? 'rain frogs' : 'reed frogs'), sa && (trop ? 'rain frogs' : 'four-eyed frogs'), au && (arid ? 'water-holding frogs' : 'striped marsh frogs'), as && (trop ? 'litter frogs' : cold ? 'Siberian salamanders' : 'tree frogs'), 'frogs'),
    rept: pick(mg && 'chameleons and skinks', na && arid && 'side-blotched lizards', na && la > 45 && 'garter snakes', na && 'skinks and fence lizards', eu && (T < 12 ? 'common lizards' : 'wall lizards'), af && (arid ? 'fringe-toed lizards' : 'rainbow skinks'), sa && In(10, 27, -86, -59) && 'anoles and dwarf geckos', sa && (trop ? 'whiptail lizards' : 'tree iguanas'), au && (arid ? 'Ctenotus skinks' : 'water skinks'), as && (trop ? 'forest skinks' : cold ? 'common lizards' : 'grass lizards'), 'lizards'),
    snake: 'snakes',
    rod: pick((R.urb || 0) > 0.15 && 'house mice and rats', mg && 'tenrecs and tufted-tailed rats', T < -6 && R.fF < 0.3 && 'lemmings', na && arid && 'kangaroo rats and pocket mice', na && (la > 47 || R.fF < 0.4) && 'deer mice and voles', na && 'white-footed mice and shrews', eu && (R.fF > 0.4 ? 'wood mice, bank voles and shrews' : 'field voles and shrews'), af && (arid ? 'gerbils' : 'multimammate mice'), au && (arid ? 'hopping mice' : 'bush rats'), sa && (trop ? 'spiny rats' : 'grass mice'), as && (arid ? 'jirds' : trop ? 'spiny rats' : la > 50 ? 'red-backed voles' : 'field mice'), 'mice and shrews'),
    bird: R.nm.birds || 'birds',
    bat: pick(mg && 'Malagasy fruit bats', sa && trop && 'leaf-nosed bats', (af || as || au) && trop && 'fruit bats and free-tailed bats', na && 'little brown bats', eu && 'pipistrelles', 'bats') };
  return { c, N };
}
// which pairs, from where on the Earth (degrees) and its climate, or from the age; on an invented world its own pair
function kinds(G, u, T, W) {
  if (G.fauna && G.fauna.none) return null;
  const E = G.E || 0;
  if (!G.real) return E === 310 ? [G_.arth, null] : E ? [{ ...G_.any, ...pick(E) }, H_.any] : [G_.any, H_.any];
  const la = Math.asin(u[2]) * 180 / PI, lo = atan2(u[1], u[0]) * 180 / PI, In = (a, b, c, d) => la >= a && la <= b && lo >= c && lo <= d;
  if (E >= 310) return E === 310 ? [G_.arth, null] : null;
  if (E >= 150) return [G_.saur, H_.allo];
  if (E >= 50) return [G_.eoh, H_.hyd];
  if (E >= 3) return [G_.hipp, H_.homo];
  const sm = smalls(la, lo, In, T, W, E);
  if (E > 0 && (T < 6 || abs(la) > 45)) return [G_.mam, In(10, 90, -170, -50) ? H_.wolf : H_.clion, ...sm];
  if (In(-48, -34, 165, 180) || In(-26, -12, 43, 51) || In(63, 67, -25, -13)) return null;   // New Zealand, Madagascar, Iceland: no native grazing herds
  if (In(59, 84, -75, -10)) return [G_.musk, H_.wolf, ...sm];              // Greenland
  if (T < -3 || abs(la) > 60) return [lo < -30 && lo > -170 ? G_.cari : G_.rein, H_.wolf, ...sm];
  if (In(-45, -10, 112, 155)) return [G_.roo, H_.dingo, ...sm];
  if (In(30, 46, 129, 146)) return [G_.sika, null, ...sm];                 // Japan: its wolves are gone
  if (In(15, 75, -170, -50)) return [...(lo > -108 && lo < -95 && W < 0.55 ? [G_.bison, H_.wolf] : lo < -100 ? [W < 0.35 ? G_.mule : G_.elk, H_.puma] : [G_.wtd, H_.wolf]), ...sm];
  if (In(-56, 15, -120, -30)) return [...(la < -20 ? [G_.guan, H_.puma] : [G_.brock, H_.jag]), ...sm];
  if (In(-36, 36, -20, 52)) return [G_.gnu, H_.lion, ...sm];
  if (In(34, 72, -12, 42)) return [G_.red, H_.wolf, ...sm];
  if (In(-12, 32, 60, 150)) return [G_.chit, H_.tiger, ...sm];
  if (In(35, 56, 42, 125) && W < 0.5) return [G_.saiga, H_.wolf, ...sm];
  return [G_.red, H_.wolf, ...sm];
}
function smalls(la, lo, In, T, W, E) {
  if (E > 0) return T < 6 || abs(la) > 45 ? [S_.mtn, s_.afox] : [];
  if (abs(la) > 66 || T < -8) return [S_.arch, s_.afox];
  if (In(15, 75, -170, -50)) return T < 2 || la > 52 ? [S_.snow, s_.lynx] : lo < -100 ? [S_.jack, s_.coy] : [S_.cot, s_.fox];
  if (In(-45, -10, 112, 155)) return [S_.rab, s_.fox];                     // both brought by people
  if (In(30, 46, 129, 146)) return [S_.jph, s_.fox];
  if (In(-56, 15, -120, -30)) return la < -20 ? [S_.mara, s_.pfox] : [S_.agou, s_.oce];
  if (In(-36, 36, -20, 52)) return [S_.scrub, s_.jack];
  if (In(-12, 32, 60, 150)) return [S_.ind, s_.gjack];
  if (In(35, 56, 42, 125) && W < 0.5) return [S_.tol, s_.cors];
  return la > 58 ? [S_.mtn, s_.fox] : [S_.eur, s_.fox];
}
const plural = (w) => w.replace(/f$/, 've') + 's';
const pick = (E) => ({ 0.02: { nm: 'woolly grazer', sz: 1.5 }, 3: {}, 50: { sz: 0.55 }, 150: { sz: 3.2, neck: 2.6, len: 1.6, life: 60, mat: 12 } })[E] || {};

// ---- one animal ------------------------------------------------------------------------------------------------------
function born(C, k, hunter, age, mom, dad, x, z) {
  const gene = (i) => (mom ? (i === 3 ? cl((mom.gn[3] + dad.gn[3]) / 2 + gs() * 0.035) : cl((mom.gn[i] + dad.gn[i]) / 2 * exp(gs() * 0.05), 0.55, 1.7)) : i === 3 ? cl(0.5 + gs() * 0.08) : exp(gs() * 0.04));
  const d = { k, hunter, age, life: k.life * rr(0.7, 1.15), male: rnd() < 0.5, nm: NM1[(rnd() * 20) | 0] + NM2[(rnd() * 16) | 0], gn: [gene(0), gene(1), gene(2), gene(3)], gen: mom ? max(mom.gen, dad.gen) + 1 : 0,
    x: x ?? (mom ? mom.x : C.hx) + rr(-12, 12) * C.sp, z: z ?? (mom ? mom.z : C.hz) + rr(-12, 12) * C.sp, a: rnd() * 6.28, mode: 0, t: rr(1, 8), tg: null, v: 0, sd: rnd(), dead: -1, why: '', run: 0 };
  d.tg = [d.x, d.z]; (hunter ? C.pack : C.herd).push(d); return d;
}
const alive = (a) => a.filter((d) => d.dead < 0);
const adult = (d) => d.age >= d.k.mat;
export const who = (d) => (d.nm ? d.nm + ' the ' : 'a ') + (d.age < d.k.mat * 0.6 ? d.k.yg : d.k.sx[+d.male]), Who = (d) => who(d).replace(/^a /, 'A ');
export const sizeAt = (d) => d.k.sz * d.gn[0] * (0.42 + 0.58 * min(1, d.age / d.k.mat));
const speedOf = (d) => d.k.run * d.gn[1] * (d.age < d.k.mat * 0.5 ? 0.82 : d.age > d.life * 0.85 ? 0.85 : 1);
const mass = (k) => k.sz ** 3;

export const drawn = [];
export function mkEco() {
  const ranges = new Map(), stands = new Map(), sites = new Map(), log = [];
  let near = [], gid = '', yearD = 365.2422, Sx = {}, store = null, saved = 0;
  const say = (R, s) => { if (R.near) { log.push({ s, t: performance.now() }); if (log.length > 30) log.shift(); } R.ev.unshift(s); if (R.ev.length > 12) R.ev.pop(); };

  // ---- a food chain in a range: the grazers of an area A (km²) and the hunters whose ground takes it in ------------
  function chain(R, g, h, A, sp) {
    const C = { g, h, A, sp, herd: [], pack: [], kp: 0, fed: 1, lean: 0, hunt: null, cool: rr(20, 90), hx: rr(-60, 60) * sp, hz: rr(-60, 60) * sp, fear: [] };
    C.K = max(6, Math.round(g.dens * A * cl(R.prod / 0.5 * (1 - 0.3 * R.fF), 0.15, 1.6)));   // head the area carries in a fair year (deer browse in woods too)
    C.TF = h ? cl(h.dens * A / max(1, h.grp * 0.7), 0.0005, 1) : 0;          // the share of the hunters' year spent here
    C.need = h ? h.need * cl(h.m0 / mass(g), 0.3, 12) : 0;                    // kills a year of this prey, each
    return C;
  }
  // ---- a range: its ground, its grass, insects and birds, its soil, and its animals ------------------------------------
  function range(G, a, sg, i, j) {
    const fk = a * 2 + (sg > 0 ? 1 : 0), key = `${fk}:${i}:${j}`; let R = ranges.get(key); if (R !== undefined) return R;
    const [b, c] = AX[a], p = [0, 0, 0]; p[b] = (i + 0.2 + 0.6 * hs2(i, j, 171 + fk)) * HS; p[c] = (j + 0.2 + 0.6 * hs2(i, j, 172 + fk)) * HS; const d = G.R * G.R - p[b] * p[b] - p[c] * p[c];
    R = null;
    if (d > 0) { p[a] = sg * sqrt(d); const h = H(G, p, 20), cm = climate(G, p, h), u = p.map((v) => v / G.R);
      if (h > 0.5) { const fF = forestF(G, p, h, cm.T, cm.W), ok = cityRho(G, p) * citySuit(h, cm.T, cm.W, 0, G) < 0.05 && river(G, p, h, cm.W) < 0.1, kk = kinds(G, u, cm.T, cm.W);
        const prod = cl(cm.W * 1.5) * cl((cm.T + 8) / 22), gK = prod * (1 - 0.7 * fF);   // how much the square grows, and how much of it is grass
        R = { key, p, h, T: cm.T, W: cm.W, fF, gK, prod, warm: cl((cm.T + 10) / 22), cold: cl((3 - cm.T) / 14), south: u[2] < 0, grass: 0.75, ins: 0.6, birds: 0.3, hawk: 0.1, spr: 2, mite: 0.3,
          ch: [], ev: [], t: G.t, near: false, la: Math.asin(u[2]) * 180 / PI, lo: atan2(u[1], u[0]) * 180 / PI, aq: 0.6, fish: 0.5, otter: 0.2, herons: [] };
        R.nm = waters(G, R.la, R.lo, cm.T); R.urb = cityRho(G, p) * citySuit(h, cm.T, cm.W, 0, G); R.cz = census(G, R, R.la, R.lo);
        // how much fresh water the square holds: a few points tested for river or lake
        let wet = 0; for (let k = 0; k < 9; k++) { const q = p.map((v, m) => v + (hs2(i * 3 + k, j, 190 + m) - 0.5) * HS * 0.9), l = hypot(...q), qg = q.map((v) => v / l * G.R), hq = H(G, qg, 16); if (river(G, qg, hq, cm.W) > 0.15 || lakeAt(G, qg.map((v) => v / G.R)) > hq) wet++; }
        R.wet = wet / 9; if (!R.nm.hawk) R.hawk = 0;
        if (kk && ok && h > 2 && cm.T > -14 && cm.W > 0.15 && fF < 0.85) {
          R.ch.push(chain(R, kk[0], kk[1], max(1, 6 / kk[0].dens), 1));         // a sparse kind's herd is the herd of a wider area
          if (kk[2]) R.ch.push(chain(R, kk[2], kk[3], PLOT, 0.35));
        }
        const st = store && store.R[key];
        if (st) restoreR(R, st); else R.ch.forEach((C) => seedChain(R, C, hs2(i, j, 174 + fk)));
      }
    }
    ranges.set(key, R); return R;
  }
  function seedChain(R, C, hh) {
    const n = floor(C.K * rr(0.45, 0.85)), g = C.g, h = C.h;
    for (let k = 0; k < n; k++) born(C, g, false, rr(0, g.life * 0.75) * rnd());
    if (n > 1) { C.herd[0].male = false; C.herd[1].male = true; C.herd[0].age = C.herd[1].age = g.mat * 1.5; }
    if (h && hh < 0.65 && n > 4) { const np = h.grp > 1 ? 2 + floor(rnd() * (h.grp - 1)) : 1 + (rnd() < 0.5 ? 1 : 0);
      for (let k = 0; k < np; k++) { const w = born(C, h, true, k < 2 ? h.mat * rr(1.2, 2.5) : rr(0.5, h.life * 0.6), null, null, C.hx + rr(80, 160) * C.sp * (k % 2 ? 1 : -1), C.hz + rr(-60, 60) * C.sp); if (k < 2) w.male = !!k; } }
  }

  // ---- the books for one range, a step of dy years -------------------------------------------------------------------
  function step(R, dy, t0, wall) {
    // grass, insects, birds: logistic regrowth; both chains of grazers and the insects eat the grass; birds eat insects
    const q = R.grass / (R.grass + 0.25); let eat = 0;                     // each chain at its carrying capacity takes a fixed share of the regrowth
    R.ch.forEach((C, ci) => { eat += (ci ? 0.2 : 0.45) * C.herd.reduce((s, d) => s + (d.dead < 0 ? sizeAt(d) ** 2.25 : 0), 0) / (C.K * C.g.sz ** 2.25); });   // intake goes as mass^0.75
    eat *= q * 0.75;
    R.grass = cl(R.grass + dy * (2.2 * R.grass * (1 - R.grass) * R.warm + 0.03 - eat - 0.3 * R.ins * R.grass), 0.01, 1);
    R.ins = cl(R.ins + dy * (R.ins * (2.6 * (0.5 * R.grass + 0.7 * R.fF) * R.warm * (1 - R.ins / 2) - 1 - 1.7 * R.birds) + 0.02), 0.01, 3);   // insects are limited by their own food too
    R.birds = cl(R.birds + dy * (R.birds * (2.2 * R.ins / (R.ins + 0.3) - 0.8 - 1.1 * R.hawk) + 0.01), 0.01, 2);
    if (R.nm.hawk) R.hawk = cl(R.hawk + dy * (R.hawk * (1.1 * R.birds / (R.birds + 0.2) - 0.5 - 0.5 * R.hawk) + 0.003), 0.002, 1.5);   // (and by their territories: a crowded sky holds fewer)   // hawks on the small birds: they follow them up and down, a year or two behind
    if (R.wet > 0) {                                                       // the streams and ponds: insects in the water, fish on them, otters and herons on the fish
      R.aq = cl(R.aq + dy * (R.aq * (2.4 * R.warm * (0.6 + 0.4 * R.fF) - 0.8 - 1.3 * R.fish) + 0.02), 0.02, 3);
      R.fish = cl(R.fish + dy * (R.fish * (1.4 * R.aq / (R.aq + 0.5) - 0.5 - (R.nm.top ? 1.2 * R.otter : 0.4)) + 0.01), 0.01, 3);
      if (R.nm.top) R.otter = cl(R.otter + dy * (R.otter * (1.0 * R.fish / (R.fish + 0.4) - 0.45) + 0.002), 0.002, 1.5);
    }
    // the soil (per cm²): springtails on the fungi of the litter, as damp and warmth allow; predatory mites on them
    const lit = 0.4 + 0.6 * R.fF, damp = cl(R.W * 1.4) * R.warm;
    R.spr = cl(R.spr + dy * (R.spr * (3 * lit * damp - 0.6 - 0.25 * R.spr - 0.9 * R.mite) + 0.05), 0.02, 12);
    R.mite = cl(R.mite + dy * (R.mite * (1.2 * R.spr / (R.spr + 1.5) - 0.55) + 0.005), 0.005, 4);
    const yr = (t0 / yearD + (R.south ? 0.5 : 0)) % 1, yr1 = ((t0 + dy * yearD) / yearD + (R.south ? 0.5 : 0)) % 1, spring = yr < 0.4 && yr1 >= 0.4, winter = !(yr > 0.4 && yr < 0.75);
    for (const C of R.ch) stepChain(R, C, dy, q, spring, winter, wall);
  }
  function stepChain(R, C, dy, q, spring, winter, wall) {
    const H0 = alive(C.herd), P0 = alive(C.pack), N = H0.length, Pa = P0.filter(adult).length, g = C.g, h = C.h, small = g.form === 'hare';
    for (const d of C.herd.concat(C.pack)) { if (d.dead >= 0) { d.dead += dy; continue; } d.age += dy;
      // the hazard of the year for this one
      const hz = d.hunter ? d.k.mort + 0.9 * max(0, 1 - C.fed / 0.75) ** 2 + 0.15 * max(0, d.gn[1] - 1) + 0.1 * max(0, d.gn[0] - 1) + (d.age < 1 ? 0.2 : 0)
        : d.k.mort + 1.2 * (1 - q) ** 2 * d.gn[0] ** 1.4 * (0.75 + 0.25 * d.gn[1]) + R.cold * 0.35 * max(0, 1.35 - d.gn[0]) + (d.age < 1 ? (small ? 0.9 : 0.12) : 0) + max(0, N / C.K - 1.6) * 0.3;
      if (rnd() < 1 - exp(-(hz + (d.age > d.life ? 2 : 0)) * dy)) { d.dead = 0; d.mode = 9; d.why = d.age > d.life ? 'died of old age' : (d.hunter ? C.fed < 0.5 : q < 0.65) ? 'starved' : R.cold > 0.3 && winter ? 'died in the winter' : d.age < 1 ? 'died young' : 'died';
        if (d.nm && (d.age >= d.k.mat || rnd() < 0.2) && (!small || rnd() < 0.1)) say(R, Who(d) + ' ' + d.why); }
    }
    // spring: the grazers' young (hares many, in several litters, fewer when crowded), then the hunters'
    if (spring) {
      const males = H0.filter((d) => d.male && adult(d) && d.dead < 0); let nb = 0;
      if (males.length) for (const m of H0) if (!m.male && adult(m) && m.dead < 0 && C.herd.length < 90) {
        const lit = g.lit * q * (1.2 - 0.2 * m.gn[2]) * cl(1.7 - N / C.K), n = floor(lit) + (rnd() < lit % 1 ? 1 : 0);
        for (let k = 0; k < n && C.herd.length < 90; k++) { born(C, g, false, 0.01, m, males[(rnd() * males.length) | 0]); nb++; } }
      else if (H0.some((d) => !d.male && adult(d))) say(R, `No ${g.sx[1]} is left here, so no ${plural(g.yg)} are born`);
      if (nb) say(R, `${nb} ${nb > 1 ? plural(g.yg) + ' were' : g.yg + ' was'} born this spring`);
      if (h && Pa >= 2) { const f = P0.find((d) => !d.male && adult(d)), m = P0.find((d) => d.male && adult(d));
        if (f && m && C.fed > 0.45 && P0.length < max(2, h.grp * 1.3)) { const n = max(0, Math.round(h.lit * cl(C.fed) * rr(0.5, 1.2))); for (let k = 0; k < n; k++) born(C, h, true, 0.01, f, m); if (n) say(R, `${Who(f)} raised ${n} ${n > 1 ? plural(h.yg) : h.yg}`); }
        if (h.grp > 1 && Pa > h.grp * 1.2) { const y = P0.filter((d) => adult(d) && d.age < d.k.mat * 2).slice(0, 2); for (const d of y) C.pack.splice(C.pack.indexOf(d), 1); if (y.length) say(R, `${y.length > 1 ? 'Two young ' + h.pl : 'A young ' + h.nm} left to find ground of their own`); }
      }
    }
    // the hunters' kills: a rate that rises with the prey and levels off; who is caught is weighted to the slow, the
    // young and the old, and to the less wary
    if (h && Pa) {
      C.kp += dy * Pa * C.need * C.TF * N / (N + 0.25 * C.K);
      C.fed = max(0, C.fed - dy * C.fed);
      while (C.kp >= 1 && N && !(R.near && wall)) { C.kp -= 1; const v = victim(alive(C.herd)); if (v) kill(R, C, v, null); else break; }
      if (N < 2) { C.lean += dy; if (C.lean > 0.5) { say(R, `The ${h.pl} moved on: there was nothing left to hunt`); C.pack = C.pack.filter((d) => d.dead >= 0); C.lean = 0; } } else C.lean = 0;
    } else if (h && !P0.length && N > 0.55 * C.K && rnd() < dy * 0.45) {
      const n = h.grp > 1 ? 2 + floor(rnd() * 2) : 1 + (rnd() < 0.5 ? 1 : 0); for (let k = 0; k < n; k++) { const w = born(C, h, true, rr(1, 2.5) * h.mat, null, null, C.hx + rr(-300, 300) * C.sp, C.hz + rr(-300, 300) * C.sp); if (k < 2) w.male = !!k; }
      say(R, n > 1 ? `${n} ${h.pl} came in from outside` : `A ${h.nm} came in from outside`); C.fed = 0.8;
    }
    if (N < 2 && R.grass > 0.5 && rnd() < dy * 0.4) { for (let k = 0; k < 2; k++) born(C, g, false, rr(1.2, 3) * g.mat, null, null, C.hx + rr(-200, 200) * C.sp, C.hz + rr(-200, 200) * C.sp).male = !!k; say(R, `Two ${g.pl} wandered in`); }
    // the dead are cleared away in a few weeks; the fear of a place fades in a year or two
    C.herd = C.herd.filter((d) => d.dead < 0.06); C.pack = C.pack.filter((d) => d.dead < 0.06);
    for (const f of C.fear) f.v -= dy * 0.7; C.fear = C.fear.filter((f) => f.v > 0);
    if (C.fear.length) { let bx = C.hx, bz = C.hz, bf = 9; const s = 250 * C.sp; for (let k = 0; k < 6; k++) { const x = rr(-s, s), z = rr(-s, s), f = fearAt(C, x, z) + hypot(x - C.hx, z - C.hz) / (400 * C.sp); if (f < bf) { bf = f; bx = x; bz = z; } } C.hx += (bx - C.hx) * cl(dy * 4); C.hz += (bz - C.hz) * cl(dy * 4); }
  }
  const fearAt = (C, x, z) => C.fear.reduce((s, f) => s + f.v * exp(-((x - f.x) ** 2 + (z - f.z) ** 2) / 12000), 0);
  function victim(H0) {
    let tot = 0; const w = H0.map((d) => { const v = (d.age < d.k.mat * 0.5 ? 2.5 : d.age > d.life * 0.8 ? 2 : 1) * exp(-3 * (d.gn[1] - 1) - 1.5 * (d.gn[2] - 1)); tot += v; return v; });
    let x = rnd() * tot; for (let k = 0; k < H0.length; k++) if ((x -= w[k]) <= 0) return H0[k]; return H0[H0.length - 1];
  }
  function kill(R, C, v, by) {
    v.dead = 0; v.mode = 9; v.why = 'killed'; C.fed += min(1, (sizeAt(v) / C.g.sz) ** 3) / max(0.3, alive(C.pack).filter(adult).length * C.need * C.TF);
    C.fear.push({ x: v.x, z: v.z, v: 1.2 }); if (C.fear.length > 8) C.fear.shift();
    if (v.nm && (rnd() < (C.g.form === 'hare' ? 0.15 : 0.5) || by)) say(R, `${by ? Who(by) : `The ${C.h.pl}`} ${C.h.grp > 1 ? 'pulled down' : 'killed'} ${who(v)}`);
  }

  // ---- what they do, second by second, near you: graze, wander, rest; run from you and from the hunters; the hunters
  // patrol, stalk, chase and feed. A chase is decided by speed: the hunter's against its quarry's, from the start it got
  function behave(G, R, C, dt, cam) {
    const H0 = alive(C.herd), P0 = alive(C.pack), chase = C.hunt, s = C.sp;
    for (const d of H0) {
      let fx = 0, fz = 0, fear = 0;
      if (cam[2] < 25) { const dc = hypot(d.x - cam[0], d.z - cam[1]), fl = 32 * d.gn[2] * (s < 1 ? 0.6 : 1); if (dc < fl) { fx += (d.x - cam[0]) / dc; fz += (d.z - cam[1]) / dc; fear = 1; } }
      for (const w of P0) { const dw = hypot(d.x - w.x, d.z - w.z), fl = (w.mode === 7 ? 70 : 28) * d.gn[2] * s; if (dw < fl) { fx += (d.x - w.x) / dw * 2; fz += (d.z - w.z) / dw * 2; fear = 1; } }
      if (fear || (chase && chase.v === d)) { d.mode = 2; d.a = atan2(fx, fz) || d.a; d.run = (d.run || 0) + dt; const v = speedOf(d) * (d.run > 12 ? 0.75 : 1) * (chase && chase.v === d ? chase.st : 1); d.x += sin(d.a) * v * dt; d.z += cos(d.a) * v * dt; d.v = v; d.t = rr(4, 9); continue; }
      d.run = 0;
      if ((d.t -= dt) < 0) { const r = rnd(); d.mode = r < 0.45 ? 0 : r < 0.85 ? 1 : 3; d.t = d.mode === 3 ? rr(20, 60) : rr(4, 20);
        if (d.mode === 1) { const a = rnd() * 6.28, rad = rr(10, 60) * s; d.tg = [C.hx + cos(a) * rad, C.hz + sin(a) * rad]; if (ground(G, R, d.tg[0], d.tg[1]) < 1) d.tg = [d.x, d.z]; } }
      if (d.mode === 1) { const dx = d.tg[0] - d.x, dz = d.tg[1] - d.z, l = hypot(dx, dz); if (l < 1) d.mode = 0; else { d.a = atan2(dx, dz); d.v = (s < 1 ? 0.8 : 1.2) * d.gn[1]; d.x += dx / l * d.v * dt; d.z += dz / l * d.v * dt; } } else d.v = 0;
    }
    if (!chase && P0.length && H0.length && (C.cool -= dt) < 0) {   // when hungry enough, the pack picks one and goes for it
      if (C.kp > 0.6 || rnd() < (C.kp < 0 ? 0.08 : 0.3)) C.hunt = { v: victim(H0), t: 0, st: rr(0.88, 1.08), phase: 0 }; C.cool = rr(60, 200);
    }
    for (const w of P0) {
      if (C.hunt && C.hunt.v.dead < 0) {
        const v = C.hunt.v, dx = v.x - w.x, dz = v.z - w.z, l = hypot(dx, dz) || 1; w.a = atan2(dx, dz);
        const sp = l > 45 * s && C.hunt.phase === 0 ? 1.6 * s : speedOf(w); if (l <= 45 * s) C.hunt.phase = 1; w.mode = C.hunt.phase ? 7 : 1; w.v = sp;
        w.x += dx / l * min(l, sp * dt); w.z += dz / l * min(l, sp * dt);
        if (l < 2 * s + 0.5) { kill(R, C, v, w); C.kp -= 1; C.hunt = null; for (const o of P0) { o.mode = 8; o.t = rr(40, 90); o.tg = [v.x + rr(-3, 3), v.z + rr(-3, 3)]; } break; }
        continue;
      }
      if (w.mode === 7) { w.mode = 1; w.t = rr(5, 15); }
      if ((w.t -= dt) < 0) { w.mode = w.mode === 8 ? 3 : rnd() < 0.5 ? 3 : 1; w.t = rr(10, 40); const a = rnd() * 6.28, rad = rr(90, 180) * s; w.tg = [C.hx + cos(a) * rad, C.hz + sin(a) * rad]; }
      if (w.mode === 1 || w.mode === 8) { const dx = w.tg[0] - w.x, dz = w.tg[1] - w.z, l = hypot(dx, dz); if (l > 1.5) { w.a = atan2(dx, dz); w.v = 1.4 * w.gn[1]; w.x += dx / l * w.v * dt; w.z += dz / l * w.v * dt; } else w.v = 0; } else w.v = 0;
    }
    if (C.hunt) { C.hunt.t += dt; const v = C.hunt.v;
      if (v.dead >= 0) C.hunt = null;
      else if (C.hunt.phase && C.hunt.t > 30 || C.hunt.t > 90) { if (C.hunt.phase && v.nm) say(R, `${Who(v)} got away from the ${C.h.pl}`); C.hunt = null; }
    }
  }
  function ground(G, R, x, z) { const q = R.p.map((v, k) => v + R.ea[k] * x + R.eb[k] * z), l = hypot(...q); return H(G, q.map((v) => v / l * G.R), 16); }

  // ---- stands: every tree near you as a living thing --------------------------------------------------------------
  const SHADE = { Abies: 0.9, Picea: 0.8, Tsuga: 0.95, Fagus: 0.95, Acer: 0.8, Tilia: 0.8, Taxus: 0.95, Carpinus: 0.85, Thuja: 0.85, Ilex: 0.9, Sequoia: 0.7, Pseudotsuga: 0.5, Nothofagus: 0.6,
    Pinus: 0.25, Betula: 0.15, Larix: 0.15, Populus: 0.1, Salix: 0.15, Eucalyptus: 0.25, Quercus: 0.45, Juniperus: 0.3, Acacia: 0.2, Fraxinus: 0.4, Castanea: 0.5, Carya: 0.5, Liriodendron: 0.25, Platanus: 0.3, Adansonia: 0.2, Carnegiea: 0.2 };
  const tolOf = (G, sp) => { const f = G.species[sp]; return f ? SHADE[f.genus] ?? 0.5 : 0.5; };
  const skey = (fk, i, j) => (fk * 2000003 + i) * 2000003 + j;
  // a site becomes a tree (the object keeps its identity, so neighbours' lists stay good)
  const asTree = (G, o, t, from) => { t.W = t.W ?? climate(G, t.p, t.h).W; return Object.assign(o, { empty: 0, t, sp: t.sp, spc: t.spc, seed: t.seed, max: 0.75 + t.seed * 0.5, tol: tolOf(G, t.sp), hT: G.species[t.sp].h * t.spc.hM, sz: 0, age: 0, snag: -1, dead: 0, fi: from ? from[0] : o.i, fj: from ? from[1] : o.j }); };
  // a stand is set up a slice at a time (so walking into new ground costs little a frame), then kept
  function stand(G, a, sg, pi, pj) {
    const fk = a * 2 + (sg > 0 ? 1 : 0), key = `${fk}:${pi}:${pj}`; let P = stands.get(key); if (P) return P;
    const st = store && store.P[key];
    P = { key, a, sg, fk, pi, pj, t: G.t, list: [], n: 0, ready: false, kept: st ? new Map(st[1].map((r) => [r[0] * 64 + r[1], r])) : null, t0: st ? st[0] : 0 };
    stands.set(key, P); return P;
  }
  function build(G, P, budget) {
    const { a, sg, fk } = P;
    while (P.n < PATCH * PATCH && budget-- > 0) {
      const li = floor(P.n / PATCH), lj = P.n % PATCH, i = P.pi * PATCH + li, j = P.pj * PATCH + lj, k = skey(fk, i, j); P.n++;
      const t = site(G, a, sg, i, j), o = { k, i, j, t, P, empty: 1 }; sites.set(k, o);
      if (P.kept) { const r = P.kept.get(li * 64 + lj); if (!r) continue;
        const fi = P.pi * PATCH + r[5], fj = P.pj * PATCH + r[6], self = fi === i && fj === j, src = self ? t : site(G, a, sg, fi, fj), q = self ? t : siteP(G, a, sg, i, j);
        if (src && q) { asTree(G, o, { p: q.p, h: q.h, W: q.W, sp: src.sp, spc: src.spc, seed: q.seed }, [fi, fj]); o.sz = r[2]; o.age = r[3]; o.snag = r[4]; P.list.push(o); }
        continue;
      }
      if (t) { asTree(G, o, t); o.sz = o.max * rr(0.55, 1); o.age = rr(20, 160); P.list.push(o); }
    }
    if (P.n >= PATCH * PATCH) { P.ready = true; if (P.kept) P.t = min(G.t, P.t0); P.kept = null; }
    return budget;
  }
  function grow(G, P, dy, R) {                                              // a year (or less) in the life of a stand
    const nb = (s, f) => {                                                  // the sites round one, found once (when all are there) and kept
      if (!s.nb) { const L = []; let all = 1; for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) { if (!di && !dj) continue; const o = sites.get(s.k + di * 2000003 + dj); if (o) L.push(o, hypot(di, dj) * TREE); else all = 0; } if (!all) { for (let k = 0; k < L.length; k += 2) { const o = L[k]; if (!o.empty && o.snag < 0) f(o, L[k + 1]); } return; } s.nb = L; }
      const L = s.nb; for (let k = 0; k < L.length; k += 2) { const o = L[k]; if (!o.empty && o.snag < 0) f(o, L[k + 1]); } };
    // browsing: seedlings are eaten in proportion to the deer on the ground (woods regenerate below about 5 red deer
    // per km², Scotland), less where the herd fears to go
    const C = R && R.ch[0], dens = C ? alive(C.herd).reduce((s, d) => s + sizeAt(d) ** 2.25, 0) / C.A : 0, browse = cl((dens - 2) / 8, 0, 1.2), def = R ? 1 - 0.3 * max(0, R.ins - 1) : 1, fire = Sx.fireAge;
    for (const s of P.list) {
      if (s.snag >= 0) { s.snag += dy; if (s.snag > 3 + s.seed * 5) s.dead = 1; continue; }
      if (fire) { const ba = fire(s.t.p); if (ba >= 0 && ba < dy * yearD + 1 && ba > 0.12) { s.snag = 0; continue; } }
      if (C && s.rk !== R.key) { const D = s.t.p.map((v, k) => v - R.p[k]); s.ex = D[0] * R.ea[0] + D[1] * R.ea[1] + D[2] * R.ea[2]; s.ez = D[0] * R.eb[0] + D[1] * R.eb[1] + D[2] * R.eb[2]; s.rk = R.key; }
      const hi = s.sz * s.hT; let shade = 0, dem = s.sz * s.sz;
      nb(s, (o, d) => { const ho = o.sz * o.hT; if (ho > hi) shade += o.sz * o.sz * (1 - d / 17) * 0.55; if (d < 11) dem += o.sz * o.sz * (1 - d / 12); });
      const light = exp(-shade), water = min(1, (s.t.W ?? 0.6) * 4 / max(dem, 0.3)), v = (light ** (1 - 0.85 * s.tol)) * water * def;
      s.light = light; s.water = water; s.age += dy;
      s.sz = min(s.max, s.sz + dy * 0.05 * v * (1.15 - s.sz / s.max));
      const m = 0.004 + 0.14 * max(0, 0.2 - v) / 0.2 * (1 - 0.6 * s.tol) + 0.1 * max(0, 0.6 - water) + (s.age > 250 + 250 * s.tol ? 0.03 : 0) + (s.sz < 0.12 ? browse * (1 - (C ? min(1, fearAt(C, s.ex, s.ez)) : 0)) * 0.5 : 0);
      if (rnd() < 1 - exp(-m * dy)) { if (s.sz < 0.15) s.dead = 1; else s.snag = 0; continue; }
      if (s.sz > 0.55 * s.max && v > 0.15 && rnd() < dy * 1.2) {             // a seed falls somewhere near
        const o = sites.get(s.k + floor(rr(-3, 4)) * 2000003 + floor(rr(-3, 4)));
        if (o && o.empty && !o.fail && o.P.ready) { if (!o.t) { const q = siteP(G, o.P.a, o.P.sg, o.i, o.j); if (!q) { o.fail = 1; continue; } o.t = q; }
          let sh = 0; nb(o, (n, d) => { sh += n.sz * n.sz * (1 - d / 17) * 0.55; });
          if (rnd() < (o.t.F ?? 0.8) * 1.4 * exp(-sh) ** (1 - 0.85 * s.tol) * min(1, (o.t.W ?? 0.6) * 3)) {
            asTree(G, o, { p: o.t.p, h: o.t.h, W: o.t.W, sp: s.sp, spc: s.spc, seed: o.t.seed ?? rnd(), F: o.t.F }, [s.fi, s.fj]); o.sz = 0.02; o.P.list.push(o);
          }
        }
      }
    }
    if (P.list.some((s) => s.dead)) P.list = P.list.filter((s) => { if (!s.dead) return true; Object.assign(s, { empty: 1, dead: 0, snag: -1, sz: 0 }); return false; });
  }
  function rangeOf(P) { let best = null, bd = 9e12; const s = P.list[0]; if (!s) return null; const p = s.t.p; for (const R of near) { if (!R.ch.length) continue; const d = (R.p[0] - p[0]) ** 2 + (R.p[1] - p[1]) ** 2 + (R.p[2] - p[2]) ** 2; if (d < bd) { bd = d; best = R; } } return best && bd < 2.5e6 ? best : null; }

  // ---- kept between visits (this browser's storage): the ranges and stands you have seen, as they were ------------------
  const pk = (d) => [d.nm, +d.male, +d.age.toFixed(2), +d.life.toFixed(1), ...d.gn.map((v) => +v.toFixed(3)), d.gen, Math.round(d.x), Math.round(d.z), +d.hunter];
  function save() {
    if (!store || !gid) return; try {
      for (const [k, R] of ranges) if (R && R.seen) store.R[k] = [R.t, +R.grass.toFixed(3), +R.ins.toFixed(3), +R.birds.toFixed(3), +R.spr.toFixed(3), +R.mite.toFixed(3), R.ch.map((C) => [+C.kp.toFixed(2), +C.fed.toFixed(2), Math.round(C.hx), Math.round(C.hz), C.herd.concat(C.pack).filter((d) => d.dead < 0).map(pk)]), [R.hawk, R.aq, R.fish, R.otter].map((v) => +v.toFixed(3))];
      for (const [k, P] of stands) if (P.ready && P.seen) store.P[k] = [P.t, P.list.map((s) => [s.i - P.pi * PATCH, s.j - P.pj * PATCH, +s.sz.toFixed(3), Math.round(s.age), s.snag < 0 ? -1 : +s.snag.toFixed(1), s.fi - P.pi * PATCH, s.fj - P.pj * PATCH])];
      const ks = Object.keys(store.P); if (ks.length > 160) for (const k of ks.slice(0, ks.length - 160)) delete store.P[k];
      const kr = Object.keys(store.R); if (kr.length > 300) for (const k of kr.slice(0, kr.length - 300)) delete store.R[k];
      localStorage.setItem('orders-eco:' + gid, JSON.stringify(store));
    } catch (e) { /* storage full or unavailable: the world just is not kept */ }
  }
  function restoreR(R, st) {
    [R.t, R.grass, R.ins, R.birds, R.spr, R.mite] = st; R.t = min(R.t, Sx.G ? Sx.G.t : R.t); if (st[7]) [R.hawk, R.aq, R.fish, R.otter] = st[7];
    st[6].forEach((cs, ci) => { const C = R.ch[ci]; if (!C) return; [C.kp, C.fed, C.hx, C.hz] = cs;
      for (const r of cs[4]) { const hunter = !!r[11], k = hunter ? C.h : C.g; if (!k) continue; const d = born(C, k, hunter, r[2], null, null, r[9], r[10]); d.nm = r[0]; d.male = !!r[1]; d.life = r[3]; d.gn = r.slice(4, 8); d.gen = r[8]; } });
  }
  addEventListener('pagehide', () => save());
  // ---- the sea under you (an 8 km square): plankton that blooms with light and the nutrients of cold water, small fish
  // on the plankton, their hunters (seals, dolphins or sharks), and whales straining the plankton and krill ----------
  const seas = new Map();
  function sea(G, S) {
    const foot = S.foot, ab = foot.map(abs), a = ab[0] >= ab[1] && ab[0] >= ab[2] ? 0 : ab[1] >= ab[2] ? 1 : 2, [b, c] = AX[a], key = `${a}${foot[a] > 0 ? '+' : '-'}:${floor(foot[b] / 8000)}:${floor(foot[c] / 8000)}`;
    let W = seas.get(key); if (!W) { const u = foot.map((v) => v / hypot(...foot)), la = Math.asin(u[2]) * 180 / PI; W = { t: G.t, la, pl: 0.6, fi: 0.5, pd: 0.15, wh: 0.2, nm: waters(G, la, atan2(u[1], u[0]) * 180 / PI, 28 - 0.45 * abs(la)) }; if (!W.nm.whale) W.wh = 0; seas.set(key, W); if (seas.size > 200) seas.delete(seas.keys().next().value); }
    let gap = min(300, (G.t - W.t) / yearD), t0 = G.t - gap * yearD;
    while (gap > 1e-9) { const dy = min(gap, 1 / 12), yr = ((t0 / yearD) + (W.la < 0 ? 0.5 : 0)) % 1, light = cl(1 - abs(W.la) / 110) * (0.55 + 0.45 * sin((yr - 0.2) * 2 * PI) * cl(abs(W.la) / 40)), nut = cl((32 - (28 - 0.45 * abs(W.la))) / 22);
      W.pl = cl(W.pl + dy * (W.pl * (3 * light * nut * (1 - W.pl / 1.6) - 1.1 * W.fi - 0.5 * W.wh) + 0.01), 0.01, 2);
      W.fi = cl(W.fi + dy * (W.fi * (1.2 * W.pl / (W.pl + 0.4) - 0.35) - 1.1 * W.pd * W.fi / (W.fi + 0.3) + 0.004), 0.01, 3);
      W.pd = cl(W.pd + dy * (W.pd * (0.8 * W.fi / (W.fi + 0.3) - 0.4) + 0.002), 0.002, 2);
      if (W.nm.whale) W.wh = cl(W.wh + dy * (W.wh * (0.5 * W.pl / (W.pl + 0.5) - 0.2 - 0.02 * W.wh) + 0.001), 0.001, 2);
      t0 += dy * yearD; gap -= dy; }
    W.t = G.t; return W;
  }

  return {
    log, ranges, kinds: { G_, H_, S_, s_ },
    // advance: the world's time since last call (from G.t) and dt seconds of yours
    tick(G, S, F, dt, wall, camH) {
      Sx = S; Sx.G = G; const T0 = performance.now();
      const id = G.id + ':' + (G.E || 0); if (id !== gid) { save(); gid = id; ranges.clear(); stands.clear(); sites.clear(); near = []; store = null; try { store = JSON.parse(localStorage.getItem('orders-eco:' + id) || 'null'); } catch (e) { /* */ } if (!store || !store.R) store = { R: {}, P: {} }; }
      yearD = G.yearD || 365.2422; if (!G.species || !G.species.length || G.lifeless || S.hc > 6000 || S.cy > 2e5) { near = []; return; }
      const foot = S.foot, ab = foot.map(abs), a = ab[0] >= ab[1] && ab[0] >= ab[2] ? 0 : ab[1] >= ab[2] ? 1 : 2, [b, c] = AX[a], sg = foot[a] >= 0 ? 1 : -1;
      // the ranges round you
      const i0 = floor(foot[b] / HS), j0 = floor(foot[c] / HS), nr = [];
      for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) { const R = range(G, a, sg, i, j); if (R) nr.push(R); }
      for (const R of near) R.near = false;
      near = nr;
      const ea = [0, 1, 2].map((k) => F[0][k]), eb = [0, 1, 2].map((k) => F[2][k]);
      for (const R of near) {
        R.near = true; R.seen = 1; R.ea = ea; R.eb = eb;
        // catch up the years since it was last seen, then this frame's share; a month a step at most
        let gap = (G.t - R.t) / yearD; if (gap > 300) gap = 300; let t0 = G.t - gap * yearD;
        while (gap > 1e-9) { const dy = min(gap, gap > 0.5 ? 1 / 6 : 1 / 12); step(R, dy, t0, wall && gap < 0.1); t0 += dy * yearD; gap -= dy; }
        R.t = G.t;
        const D = R.p.map((v, k) => v - foot[k]), cx = -(D[0] * ea[0] + D[1] * ea[1] + D[2] * ea[2]), cz = -(D[0] * eb[0] + D[1] * eb[1] + D[2] * eb[2]); R.cam = [cx, cz];
        if (wall && dt > 0) for (const C of R.ch) behave(G, R, C, min(dt, 0.1), [cx, cz, camH]);
        // herons, as many as the fish keep, each found a place in the shallows (one try a frame)
        if (R.wet > 0 && R.nm.heron) { const want = min(4, Math.round(R.otter * 8 * R.wet + 0.3)); while (R.herons.length > want) R.herons.pop();
          if (R.herons.length < want && dt > 0) { const x = rr(-450, 450), z = rr(-450, 450), q = R.p.map((v, m) => v + ea[m] * x + eb[m] * z), l = hypot(...q), qg = q.map((v) => v / l * G.R), hq = H(G, qg, 16);
            if (hq > 0.2 && river(G, qg, hq, R.W) > 0.3) R.herons.push({ k: R.nm.heron, hunter: true, age: 6, life: 20, male: rnd() < 0.5, nm: NM1[(rnd() * 20) | 0] + NM2[(rnd() * 16) | 0], gn: [exp(gs() * 0.04), 1, 1, 0.5], gen: 0, x, z, a: rnd() * 6.28, mode: 0, t: rr(5, 30), v: 0, sd: rnd(), dead: -1, why: '' }); }
          for (const hn of R.herons) if ((hn.t -= dt) < 0) { hn.t = rr(8, 40); if (rnd() < 0.15 * R.fish && R.near) say(R, `${Who(hn)} caught a ${R.nm.fish.replace(/s$/, '')}`); } }
      }
      const T1 = performance.now();
      // the stands round you (within about 250 m): set up a slice a frame, then kept up a year at a time
      const pi0 = floor(foot[b] / TREE / PATCH), pj0 = floor(foot[c] / TREE / PATCH), here = []; let bud = 900, setup = 48;
      for (let pi = pi0 - 2; pi <= pi0 + 2; pi++) for (let pj = pj0 - 2; pj <= pj0 + 2; pj++) {
        const P = stand(G, a, sg, pi, pj); if (!P.ready) { if (setup > 0) setup = build(G, P, setup); if (!P.ready) continue; } P.seen = 1; here.push(P);
      }
      here.sort((x, y) => x.t - y.t);
      for (const P of here) { if (G.t - P.t > 200 * yearD) P.t = G.t - 200 * yearD;
        let R; while ((G.t - P.t) / yearD >= 0.25 && bud > 0) { R = R ?? rangeOf(P); const dy = min((G.t - P.t) / yearD, 1); grow(G, P, dy, R); P.t += dy * yearD; bud -= P.list.length + 1; } }
      this.prof = [T1 - T0, performance.now() - T1];
      if (sites.size > 120000) { for (const [k, P] of stands) if (abs(P.pi - pi0) > 3 || abs(P.pj - pj0) > 3) { for (let i = P.pi * PATCH; i < (P.pi + 1) * PATCH; i++) for (let j = P.pj * PATCH; j < (P.pj + 1) * PATCH; j++) sites.delete(skey(P.fk, i, j)); stands.delete(k); } }
      if (ranges.size > 400) for (const [k, R] of ranges) if (!R || !R.near) { ranges.delete(k); if (ranges.size < 300) break; }
      if (performance.now() - saved > 15000) { saved = performance.now(); save(); }
    },
    save: () => save(),
    sea: (G, S) => (G.species && G.species.length && !G.lifeless ? sea(G, S) : null),
    seaText(W) { return W ? `plankton ${W.pl.toFixed(1)} · small fish ${W.fi.toFixed(1)} · ${W.nm.pred} ${W.pd.toFixed(1)}${W.nm.whale ? ` · ${W.nm.whale} ${W.wh.toFixed(1)}` : ''}` : ''; },
    near: () => near,
    _step: (R, dy, t0) => step(R, dy, t0, false), _behave: behave,
    // a tree site as it stands now: undefined if this site is not in a stand being kept, null if nothing stands
    site(k) { const s = sites.get(k); if (!s || !s.P.ready) return undefined; if (s.empty) return null; return s; },
    at(p) { let best = null, bd = 4e6; for (const R of near) { const d = (R.p[0] - p[0]) ** 2 + (R.p[1] - p[1]) ** 2 + (R.p[2] - p[2]) ** 2; if (d < bd) { bd = d; best = R; } } return best; },
    birdsAt(p) { const R = this.at(p); return R ? R.birds / 0.3 : 1; },
    hawksAt(p) { const R = this.at(p); return R && R.nm.hawk ? R.hawk / 0.2 : 0; },
    // what is here, in a line: the herds and hunters, the grass, the insects, the birds
    here(S) {
      const R0 = this.at(S.foot); if (!R0) return ''; let R = R0, bg = 2.6e6; const f = S.foot;
      for (const r of near) { const d = (r.p[0] - f[0]) ** 2 + (r.p[1] - f[1]) ** 2 + (r.p[2] - f[2]) ** 2; if (r.ch.length && d < bg) { bg = d; R = r; } }
      const pc = (v) => (v >= 1 ? '+' : '−') + abs(Math.round((v - 1) * 100)) + '%', out = [];
      R.ch.forEach((C, ci) => {
        const H0 = alive(C.herd), P0 = alive(C.pack), yg = H0.filter((d) => d.age < 1).length, gen = H0.length ? max(...H0.map((d) => d.gen)) : 0, m = (i) => H0.length ? H0.reduce((s, d) => s + d.gn[i], 0) / H0.length : 1;
        out.push(`${H0.length} ${H0.length === 1 ? C.g.nm : C.g.pl}${yg ? ` (${yg} ${yg > 1 ? plural(C.g.yg) : C.g.yg})` : ''}` + (C.h ? `, ${P0.length} ${P0.length === 1 ? C.h.nm : C.h.pl}` : '') + (ci ? ' in 10 ha' : C.A > 1.01 ? ` in ${Math.round(C.A)} km²` : '') + (gen && !ci ? ` · generation ${gen}: size ${pc(m(0))}, speed ${pc(m(1))}, wariness ${pc(m(2))}` : ''));
      });
      out.push(`grass ${Math.round(R0.grass * 100)}% · insects ${R0.ins.toFixed(1)} · ${R0.nm.birds || 'birds'} ${(R0.birds / 0.3).toFixed(1)}×` + (R0.nm.hawk ? ` · ${R0.nm.hawk}s ${(R0.hawk / 0.4).toFixed(1)}×` : ''));
      if (R0.wet > 0) out.push(`in the water: insects ${R0.aq.toFixed(1)}, ${R0.nm.fish} ${R0.fish.toFixed(1)}` + (R0.nm.top ? `, ${R0.nm.top}s ${R0.otter.toFixed(1)}` : '') + (R0.herons.length ? `, ${R0.herons.length} ${R0.herons.length > 1 ? R0.nm.heron.pl : R0.nm.heron.nm}` : ''));
      return out.join(' · ');
    },
    // the census of a hectare here (see census()), the live parts from the pools and herds: how many of each class live
    // here, and how many of them are out on the surface now (per m²) for fauna.js to draw. The activity is the model's:
    // salamanders and frogs come up on wet nights, lizards bask on warm days, mice run at night, bats hunt after dusk
    census(S) {
      const R = this.at(S.foot); if (!R || !R.cz) return null;
      const { c, N } = R.cz, ins = cl(R.ins / 0.6, 0.3, 2), q = sqrt(ins), Tn = S.Tnow ?? R.T, day = (S.sun || [0, 1, 0])[1], rain = S.rain || 0, snow = (S.packHere || 0) > 0.3;
      const n = { ant: c.ant * q, worm: c.worm, amph: c.amph * q, rept: c.rept * q, snake: c.snake * q, rod: c.rod, bird: c.bird * R.birds / 0.3, bat: c.bat * q }, big = [];
      for (const C of R.ch) for (const [k, L] of [[C.g, C.herd], [C.h, C.pack]]) { if (!k) continue; const m = alive(L).length / (C.A * 100); if (m > 0) big.push([k.pl, m, 1.2e5 * k.sz ** 3]); }
      const night = day < -0.05, act = { ant: Tn > 8 ? 0.005 : 0, worm: night && rain > 0.3 && Tn > 3 ? 0.002 : 0, amph: Tn < 2 || snow ? 0 : night ? 0.04 + 0.25 * rain : 0.003 + 0.05 * rain,
        rept: day > 0.05 && Tn > 12 ? 0.35 * cl((Tn - 12) / 12) : 0, snake: day > 0.05 && Tn > 15 ? 0.1 : 0, rod: snow ? 0 : night ? 0.3 : 0.02, bat: Tn > 6 && day < 0.03 ? 1 : 0 };
      const surf = {}; for (const k in act) surf[k] = n[k] * act[k] / 1e4;
      const f = (v) => v >= 1e6 ? (v / 1e6).toFixed(1) + ' million' : v >= 100 ? (Math.round(v / 10) * 10).toLocaleString() : v >= 10 ? Math.round(v) + '' : v >= 0.1 ? v.toFixed(1) : '1 per ' + Math.round(1 / v) + ' ha';
      const L = Object.keys(n).filter((k) => n[k] > 0 && k !== 'snake').map((k) => [N[k], n[k], CM[k]]).concat(big), wt = L.map(([nm, v, g]) => [nm, v * g]).sort((a, b) => b[1] - a[1]);
      const text = 'per hectare: ' + L.map(([nm, v]) => (v < 0.1 ? `${nm} ${f(v)}` : `${f(v)} ${nm}`)).join(' · ') + ` · by weight: ${wt.slice(0, 4).map(([nm, w]) => nm + (w >= 1e3 ? ` ${(w / 1e3).toFixed(w >= 1e4 ? 0 : 1)} kg` : ` ${Math.round(w)} g`)).join(' > ')}`;
      return { text, surf, N, n };
    },
    soil(S) { const R = this.at(S.foot); return R ? `each cm² here holds about ${R.spr < 1 ? R.spr.toFixed(1) : Math.round(R.spr)} springtails and ${R.mite < 1 ? R.mite.toFixed(1) : Math.round(R.mite)} predatory mites` : ''; },
    grassAt(p) { const R = this.at(p); return R ? cl(R.grass / 0.75, 0.15, 1.2) : 1; },
    insAt(p) { const R = this.at(p); return R ? R.ins : 0.6; },
    stand() { let n = 0, yg = 0, sn = 0, L = 0; for (const P of stands.values()) if (P.ready) for (const s of P.list) { if (s.snag >= 0) sn++; else { n++; if (s.sz < 0.25) yg++; L += s.light ?? 1; } } return n ? `${n.toLocaleString()} trees near you, ${yg} young, ${sn} snags, ${Math.round(100 * L / n)}% of the light reaching the average crown` : ''; },
  };
}
