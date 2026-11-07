# The Kelp Forest

The first preview is a rocky Monterey Bay habitat at 0–15 m. It uses giant kelp
(*Macrocystis pyrifera*) as its reference: stipes are anchored to rock, with
gas floats and blades along their length. From the low resting camera, staggered
beds on both sides frame an open channel of green water. Near beds reach into the
phone crop, and outer beds fill the wider view. [Monterey Bay Aquarium](https://www.montereybayaquarium.org/animals-the-ocean/ecosystems/kelp-forest)
and [NOAA Monterey Bay National Marine Sanctuary](https://montereybay.noaa.gov/science/characterization/kelp-forests.html).

## Motion and contact

`src/data/landscapes.js` owns the bed layout and asset paths. `KelpForest.jsx`
raycasts the drawn rock meshes at mount to pin each holdfast. `kelpMotion.js`
simulates 17 stipe points and eleven blades, with a middle and tip per blade.
Damped Verlet integration and six length solves carry the swell up each stipe.
The stipe starts from a shallow S-curve. A shorter current wave (about 37 WU per
cycle) travels along it over the slower bed-wide swell, so sections can bend
at different times. The rendered stipe is 0.15 WU wide.
Nearby registered fish contribute body-length capsules. The diver camera carries a
1.2 WU sphere in Diver mode, so the contact can be reviewed before stocking.
Both shapes project points out and remove inward velocity. Contact moves the kelp
only. The mesh follows a spline through each chain and uploads two batches per bed.
Visible plants step at up to 60, 30, or 15 Hz by distance. Offscreen plants farther
than 9 WU and all plants farther than 105 WU hold their pose until active again.

## Replace either starter asset

1. Export one self-contained GLB per slot with one static mesh and one material.
   Apply transforms before export. In GLB space, use **+Y from base to tip**,
   **X across**, and **Z for relief**. Center the base on X/Z = 0. The renderer
   normalizes the span and width and applies the scene scale. Keep the meshes low-poly.
2. For `bladeModel`, supply one card with the attachment centered on its bottom
   edge. Add several subdivisions along +Y so the card follows the middle and tip.
   Embed its texture and use glTF alpha mask for a cutout. The blade renders on both faces.
3. For `stemModel`, supply one open-ended segment with matching rings at its
   ends and a few intermediate rings if needed. Its UVs should tile end-to-end.
   The renderer repeats it once per link and bends each copy along the same spline.
4. Put the GLBs under `public/models/landscape/` and set their independent paths in
   `LANDSCAPES.kelpForest.kelp`. A `null` path selects the generated starter for
   that slot. The environment manifest loads either replacement with the reserve.

Review from the selector, then use **Controls → Diver camera** to swim into a stipe
and watch the blades follow and settle. The preview roster is empty pending a
separate species selection. Retake the selector still once the art is accepted.
