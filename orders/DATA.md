# The measured data in the 2 MB rung (the Earth, without a cut)

`source/continuous/earthdata.js` (inlined in `2mb/index.html`) holds the grids below, packed by
`source/tools/earthpack.py` into one raw-deflate stream. Every grid runs from 90°N in rows and from 180°W in columns.
Each is stored as the residual of the median edge predictor (MED, as in LOCO-I) from its neighbours, then deflated.

- **Ground and sea floor: ETOPO 2022** (NOAA NCEI, doi:10.25921/fd45-gt74; US government work, no restrictions;
  please cite it), read every 3 arc-minutes. Land as the mean of each 6′ cell (a square-root code: 1 m steps near sea
  level, about 40 m on the highest summits); the sea floor as the mean over each 24′ cell. Land below sea level away
  from the ocean (the shores of the Caspian, the Dead Sea, Qattara, Death Valley, the polders) is lifted to between 1
  and 3 m, because the engine's sea fills everything below 0. Lakes below sea level stand at 2 m for the same reason.
- **Lakes: Natural Earth 1:50m lakes** (public domain, naturalearthdata.com), rasterised on the 6′ grid: the 255
  largest, each at a surface height read from ETOPO (the median of its cells, or for lakes whose floors ETOPO sounds,
  the shore round it). Their beds are drawn 15 m under the surface; their real depths are not used.
- **Climate: CRU CL 2.0** (New et al. 2002, Climatic Research Unit, University of East Anglia; ODbL 1.0 with DbCL
  1.0; this derived database is shared under the same terms): half-degree means of the year's temperature brought to
  sea level at 6.5 °C/km, half the July less January temperature, and the year's rainfall. The sea is filled from the
  nearest land, eased toward a band average far out.
- **Tree genera: Little's range maps (USGS, public domain) and Caudullo et al. 2017 (CC BY 4.0)**, as below: nine
  genera in North America and Europe on the quarter-degree grid. The other 55 genera on the page are placed by rules
  (region boxes and climate), written in `source/continuous/real.js`; so are all the species names within a genus.
- **The Moon: LOLA LDEM_4** (Smith et al., LRO Lunar Orbiter Laser Altimeter, NASA PDS; public domain).
  **Mars: MOLA MEGDR megt90n000cb** (Smith et al., MGS Mars Orbiter Laser Altimeter, NASA PDS; public domain).
  **Venus: Magellan global topography 4641 m** (USGS Astrogeology; public domain).
  **Mercury: MESSENGER global DEM 665 m** (USGS Astrogeology, after Becker et al. 2016; public domain).
  The Moon and Mars as the mean over half-degree cells in 50 m steps, Venus and Mercury over one-degree cells in 40 m
  steps, each raised by its lowest point plus a margin so none of it is
  under a sea.
- **Not data, but measured:** planet positions from JPL's approximate Keplerian elements (Standish), the Moon from
  the largest terms of its theory, the turning of every body from the IAU rotation models (Archinal et al. 2011),
  the Milky Way's orientation from the IAU galactic pole and centre. Everything finer than the maps (the octaves of
  detail, the craters, the species within a genus, the towns) is invented, and the page and README say so.

# The measured data in the earlier rungs

`source/src/data.js` (inlined in `2mb/index.html`) holds the derived grids below, packed by `source/tools/pack_data.py`.
`source/src/data200.js` (inlined in `200kb/index.html`) holds the same grids in bigger blocks, each value the mean of
its block: climate in 3° blocks, heights and tree ranges (a genus counts if it counts anywhere in the block) in 1.5°.
`source/src/kg200.js` holds the Köppen-Geiger classes in half-degree blocks, the commonest class in each
(`source/tools/coarse_kg.py`). These are derived databases of the same sources, under the same terms:

- **Climate: CRU CL 2.0 monthly normals, 1961–90.** This is a derived database: half-degree averages of temperature
  reduced to sea level, and of rainfall. Source: New, M., Lister, D., Hulme, M. and Makin, I. (2002), A
  high-resolution data set of surface climate over global land areas, *Climate Research* 21, 1–25. Attribution:
  Climatic Research Unit, University of East Anglia. The source is made available under the Open Database Licence
  (ODbL 1.0), and its contents under the Database Contents Licence (DbCL 1.0). This derived database is shared under
  the same terms: https://opendatacommons.org/licenses/odbl/1-0/
- **Ground height: ETOPO 2022.** For each quarter-degree land cell, the mean and lowest height of the land. Source:
  NOAA National Centers for Environmental Information (2022), ETOPO 2022 15 Arc-Second Global Relief Model,
  doi:10.25921/fd45-gt74. It is a US government work, so no restrictions apply; please cite it.
- **Tree genera: two range-map sources.** For each quarter-degree land cell, whether Quercus, Fagus, Picea, Pinus,
  Betula, Abies, Larix, Acer or Tilia has a native range touching it:
  - North America: Little, E. L. (1971–1978), *Atlas of United States Trees*, US Department of Agriculture Forest
    Service. Public domain. Digitised versions are at https://github.com/wpetry/ustreeatlas, which warns of some
    digitising errors.
  - Europe: Caudullo, G., Welk, E. and San-Miguel-Ayanz, J. (2017), Chorological maps for the main European woody
    species, *Data in Brief* 12, 662–666, doi:10.1016/j.dib.2017.05.007. CC BY 4.0.
- **Climate classes:** see `source/src/kg.js` (kgcpy, BSD licence, after Rubel et al. 2017).
