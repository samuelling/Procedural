# Brief for the scale-binding dialogue

The project: "Orders of Magnitude", a procedural forest built at five byte allowances (0.2 kB, 2 kB, 20 kB, 200 kB, 2 MB),
where the whole HTML file counts and nothing stored may be an image or a model (measured data that is not an image or
model is allowed if labelled). Source: /home/claude/orders/src (main.js app and zoom, grow.js world builder, genome.js
species and worlds, fx.js life sim + shaders + drawings, gl.js WebGL renderer, micro.js the small worlds, range.js the
mountain range, valley.js the valley round the plot, erosion.js, earth.js + kg.js Earth climate grid, under.js lake/kelp
/cave dressing, cave3.js true 3D cave, audio.js). README.md and ROADMAP.md describe what exists. The 2 MB rung is at
113 kB on disk, so about 1.88 MB is spare. The 20 kB rung is 40 bytes from its cap: anything new must be TIER > 3 only
and must fold away at build time.

## The owner's ask (Sam Ling, visual neuroscientist)

"Keep coming up with ways to build the world until you get near the 2 MB allowance. Think about connecting the
different scales of views: right now they're very discrete, almost separate representations. Algorithmically binding
those scales more naturally together would help. But think of what could help."

## How the scales connect today (main.js ~line 325)

A ladder: range ÷10,000 → plot ×1 (via the valley) → rotting log ×100 → moss ×1000 (or under the bark) → soil ×10,000
→ leaf ×100,000. Zooming glides the camera to the spot, copies the last frame, grows the next world from a fixed genome
(GENOMES[LAD[j]]) with the same seed, and dissolves the frame into it. So:

- The log world is the same whichever log, tree or place you dived from. The leaf world does not know which species'
  leaf it is. The soil does not know the climate or the forest above. The range is not the range the plot sits in.
- The clock, season, weather, year and Earth place (G.cl) do not carry across a dive.
- Animals do not cross scales. Nothing of the inner world is visible before the swap.
- Earth (a quarter-degree Köppen grid) → a forest genome for that place; deep time (erosion, nine past ages) and the
  cave, lake and kelp are side doors with their own genomes.

## Rules of the dialogue

Two voices. **Ash** is a naturalist-builder who proposes. **Rowan** is a sceptical engineer who checks proposals against
the code, the byte budget, frame time (WebGL1, phones), and honesty (what would be true, what would be fake). Each turn
should be concrete: name files and functions, estimate bytes and cost, say what a viewer would see. Disagree where
warranted. End with an agreed, ordered build list for the next round, small enough to build, render-check and
publish in one sitting, plus a longer queue toward 2 MB.
