# The measured data in the 2 MB and 200 kB rungs

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
