# Deforming Ocean Surface

Status: `v0.14.0-dev_1` on `feat/deforming-ocean-surface`, awaiting visual and physical-phone review. This feature is intentionally separate from the cinematic-camera branch.

## Felt intention

The surface should feel like a large body of water breathing above the animals: slow overlapping pressure, occasional changing highlights, and no obvious looping sheet. It must remain atmosphere rather than spectacle. From below, deformation matters because the ceiling silhouette and light response move together instead of a flat plane merely changing color.

## Why a displaced plane

Real-time water commonly starts with a subdivided grid. A vertex shader displaces its points each frame; the fragment shader shades the resulting geometry. The alternatives scale upward in cost:

- scrolling normal maps animate light but leave geometry flat;
- layered sine or Gerstner waves deform geometry cheaply and predictably;
- FFT/spectral oceans produce broad realistic seas but require simulation textures/render targets and are unnecessary for this enclosed view.

World Oceanarium uses layered Gerstner waves: enough directional interaction to avoid one regular sine sheet, deterministic per tank, and practical on mobile.

## Implemented shape

- one `210 × 210 WU` plane overscanning the tank ceiling;
- `96 × 96` segments, about 9.4k vertices and one draw call;
- three directional Gerstner layers:
  - wavelength `22 WU`, amplitude `0.24 WU`;
  - wavelength `13 WU`, amplitude `0.14 WU`;
  - wavelength `9 WU`, amplitude `0.075 WU`;
- restrained steepness and independent speeds;
- deterministic tank-seeded phase offsets;
- all displacement runs in the vertex shader—no per-frame CPU geometry mutation or allocation.

Total vertical excursion remains below `0.455 WU` (about 11.4 cm at `1 WU = 25 cm`). Existing fish/camera surface clearances remain larger than the deformation envelope.

## Normals and shading

Each wave contributes analytic derivatives to two surface tangents. Their cross product produces the displaced normal in the same vertex pass. The fragment shader uses that normal for quiet slope, Fresnel, and crest response while preserving the existing procedural caustic/shimmer treatment.

This avoids `computeVertexNormals()` on the CPU every frame and keeps highlights synchronized with the physical wave shape.

## Edge treatment

The prior mesh was `210 × 32 WU`, so upward views could reveal its rectangular end. The physical mesh now overscans `210 × 210 WU`. The established shimmer region still uses the old 32 WU world-space scale, so expanding geometry does not stretch or retune the accepted caustic pattern.

## Performance contract

- one mesh, one material, one draw call;
- about 9.4k vertices;
- three wave evaluations per vertex;
- no FFT, simulation framebuffer, reflection/refraction pass, CPU vertex upload, or per-frame React state;
- static geometry topology and mutable shader time uniform only.

The initial review build favors predictable mobile cost over ocean-scale realism. A future quality tier could reduce grid density on very weak devices, but it should be justified by physical-phone profiling rather than user-agent guessing.

## Review checklist

- default tank remains calm and fish stay readable;
- upward/follow views expose no rectangular surface edge;
- deformation reads as water, not cloth or rolling terrain;
- highlights remain subtle rather than chrome-like;
- The Open Sea and The Drift use different deterministic phases;
- desktop and physical-phone frame pacing remain stable;
- Atlas surface use remains visually unobtrusive.
