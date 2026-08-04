# Deforming Ocean Surface

Status: accepted and promoted as clean `v0.13.0` from the historically labeled `v0.14.0-dev_12` review build after Jeremy reju. The clean number was corrected to follow `v0.12.3`; this feature remained separate from the cinematic-camera branch.

## Felt intention

The surface should feel like a large body of water breathing above the animals: slow overlapping pressure, occasional changing highlights, and no obvious looping sheet. It must remain atmosphere rather than spectacle. From below, deformation matters because the ceiling silhouette and light response move together instead of a flat plane merely changing color.

## Why a displaced plane

Real-time water commonly starts with a subdivided grid. A vertex shader displaces its points each frame; the fragment shader shades the resulting geometry. The alternatives scale upward in cost:

- scrolling normal maps animate light but leave geometry flat;
- layered sine or Gerstner waves deform geometry cheaply and predictably;
- FFT/spectral oceans produce broad realistic seas but require simulation textures/render targets and are unnecessary for this enclosed view.

World Oceanarium uses layered Gerstner waves: enough directional interaction to avoid one regular sine sheet, deterministic per tank, and practical on mobile.

## Implemented shape

- one `320 × 320 WU` plane whose distance fade reaches zero before any geometric edge;
- `256 × 256` segments, 66,049 vertices, 131,072 triangles, and one surface draw call;
- six directional Gerstner waves arranged as three crossed scales:
  - coarse: `22 WU / 0.035 WU` crossed with `15 WU / 0.029 WU` (`0.064 WU` pair magnitude);
  - medium: `9 WU / 0.020 WU` crossed with `6.5 WU / 0.016 WU` (`0.036 WU` pair magnitude);
  - fine: `5.2 WU / 0.011 WU` crossed with `4.5 WU / 0.008 WU` (`0.019 WU` pair magnitude);
- restrained steepness and independent speeds;
- deterministic tank-seeded phase offsets;
- all displacement runs in the vertex shader—no per-frame CPU geometry mutation or allocation.

Total vertical excursion remains below `0.119 WU` (2.975 cm at `1 WU = 25 cm`). The magnitude budget is redistributed rather than increased: coarse structure carries the largest physical displacement, medium waves articulate it, and fine waves break up reflected regularity without producing busy chop. Existing fish/camera surface clearances remain larger than the deformation envelope.

## Normals and physical shading

Each wave contributes analytic derivatives to two surface tangents. Their cross product produces the displaced normal in the same vertex pass. A real Three.js `MeshPhysicalMaterial` then uses those normals for Fresnel reflection, roughness, clearcoat, transmission, IOR `1.333`, thickness, and absorption. The material covers the entire mesh; there is no front-only alpha mask or bespoke fragment-color strip.

The water material has its own 1K HDR environment, Qwantani Pure Sky by Poly Haven (CC0), at environment intensity `8.0`. This makes reflected sky highlights shine above the blue water body without replacing the scene background or the environment used to light creatures. The local attribution and source live in `public/hdr/README.md`.

This avoids `computeVertexNormals()` on the CPU every frame and keeps the HDR highlights synchronized with the physical wave shape.

## Edge treatment

The prior mesh was `210 × 32 WU`, so upward views could reveal its rectangular end and the fragment alpha mask showed material only across a near strip. The physical material is continuous across the full `320 × 320 WU` ceiling. Camera-distance fade (`45–120 WU`) reaches zero before the plane edge, while view-facing fade (`0.16–0.44`) preserves nearby HDR reflection and dissolves grazing geometry. Nearby overhead water remains fully physical. The default camera now looks only about `3.4°` upward (`lookY=-2.75`), keeping the horizontal ceiling near the top of portrait framing without moving its physical world height or changing follow framing.

## Performance contract

- one mesh, one material, one surface draw call;
- about 25.9k vertices;
- three wave evaluations per vertex;
- one Three.js transmission/refraction prepass at half linear resolution (quarter pixel count);
- no FFT, simulation framebuffer, CPU vertex upload, or per-frame React state;
- static geometry topology and mutable shader time uniform only.

The half-resolution refraction target preserves the blurred moving-water look while containing the physical material's main mobile cost. Physical-phone profiling remains a release gate; if needed, the next quality tier should reduce transmission resolution before removing deformation or reverting to fake water.

## Review checklist

- default tank remains calm and fish stay readable;
- upward/follow views expose no rectangular surface edge;
- deformation reads as water, not cloth or rolling terrain;
- highlights remain subtle rather than chrome-like;
- The Open Sea and The Drift use different deterministic phases;
- desktop and physical-phone frame pacing remain stable;
- Atlas surface use remains visually unobtrusive.
