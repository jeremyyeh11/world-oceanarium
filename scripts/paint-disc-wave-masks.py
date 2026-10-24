"""Paint a ray's disc-wave masks from its shape, and export it to the disc-wave contract.

    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
        --python scripts/paint-disc-wave-masks.py -- <in.glb> <out.glb> [--span 1.3] [--name munks_devil_ray] [--images AUTO]

Jeremy models the ray; this computes the three COLOR_1 masks (docs/procedural/disc-wave.md)
rather than hand-painting them, since vertex paint can't paint one channel alone and the
masks are pure geometry:

- R, wing weight: 0 across the body (|x| up to `--body` of the half span, about the head's
  width), rising linearly to 1 at the wingtip. The shader eases it (marginRampPower).
- G, chord position: at each station across the span, 0 at the wing's leading edge to 1 at
  its trailing edge, from the outline of the disc at that station.
- B, tail weight: 0 where the tail leaves the disc to 1 at its tip; R and G are 0 and 1 there.

It also scales the model so the disc is `--span` metres wide (1 unit = 1 m), puts the origin at
the centre of the disc (midway between the front of the head and the tail root, on the
midline), applies transforms, renames the mesh (`--name`; three.js names the per-material
parts <name>, <name>_1, ...), replaces every colour attribute with a white COLOR_0 and the
masks as COLOR_1, and exports. The input file is never modified. Nose must already face -Z.
"""
import sys
import bpy
import bmesh
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, dst = argv[0], argv[1]
def option(name, default):
    return type(default)(argv[argv.index(name) + 1]) if name in argv else default
SPAN = option('--span', 1.3)
NAME = option('--name', 'munks_devil_ray')
BODY = option('--body', 0.17)
# Where the disc ends and the tail begins: the first station, from the back, where the body is
# wider than this share of the half span.
TAIL_WIDTH = option('--tail-width', 0.04)
BINS = 60

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if len(meshes) != 1:
    sys.exit(f'expected one mesh object, found {len(meshes)}: {[o.name for o in meshes]}')
obj = meshes[0]
for o in bpy.context.scene.objects:
    o.select_set(o == obj)
bpy.context.view_layer.objects.active = obj
if obj.parent:
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

mesh = obj.data
mesh.name = NAME
obj.name = NAME
# glTF import gives Blender +Y forward/-Y back for glTF -Z/+Z: work in glTF axes throughout.
def gltf(co):
    return Vector((co.x, co.z, -co.y))
points = [gltf(v.co) for v in mesh.vertices]

half = max(abs(p.x) for p in points)
scale = (SPAN / 2) / half
z_min = min(p.z for p in points)
z_max = max(p.z for p in points)
# Half-width per z slice, front to back, to find where the disc ends and the tail starts.
slices = [0.0] * BINS
for p in points:
    k = min(BINS - 1, int((p.z - z_min) / (z_max - z_min) * BINS))
    slices[k] = max(slices[k], abs(p.x))
tail_slice = BINS - 1
while tail_slice > 0 and slices[tail_slice] < TAIL_WIDTH * half:
    tail_slice -= 1
tail_root = z_min + (tail_slice + 1) / BINS * (z_max - z_min)
centre = Vector((0.0, (min(p.y for p in points) + max(p.y for p in points)) / 2, (z_min + tail_root) / 2))

# The disc's outline per station across the span: leading and trailing edge z, from every disc
# vertex within a window either side of the station. A sparse mesh leaves narrow slices holding
# only interior vertices, which made the chord position blotchy; the window always reaches the
# outline. It slightly favours the outer edge on a swept wing, a few percent of the chord.
STATIONS = 80
WINDOW = option('--window', 0.06) * half
disc = [(abs(p.x), p.z) for p in points if p.z <= tail_root]
lead = []
trail = []
for k in range(STATIONS + 1):
    ax = k / STATIONS * half
    near = [z for x, z in disc if abs(x - ax) <= WINDOW]
    lead.append(min(near) if near else None)
    trail.append(max(near) if near else None)
for edge in (lead, trail):
    known = [k for k in range(len(edge)) if edge[k] is not None]
    for k in range(len(edge)):
        if edge[k] is None:
            edge[k] = edge[min(known, key=lambda j: abs(j - k))]
def edges_at(ax):
    f = ax / half * STATIONS
    k = max(0, min(STATIONS - 1, int(f)))
    t = max(0.0, min(1.0, f - k))
    return lead[k] + (lead[k + 1] - lead[k]) * t, trail[k] + (trail[k + 1] - trail[k]) * t

masks = []
for p in points:
    ax = abs(p.x)
    if p.z > tail_root:
        b = (p.z - tail_root) / max(1e-6, z_max - tail_root)
        masks.append((0.0, 1.0, max(0.0, min(1.0, b))))
        continue
    r = max(0.0, min(1.0, (ax / half - BODY) / (1 - BODY)))
    le, te = edges_at(ax)
    g = max(0.0, min(1.0, (p.z - le) / max(1e-6, te - le)))
    masks.append((r, g, 0.0))

for attribute in list(mesh.color_attributes):
    mesh.color_attributes.remove(attribute)
white = mesh.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
mask = mesh.color_attributes.new('mask', 'FLOAT_COLOR', 'POINT')
for i, (r, g, b) in enumerate(masks):
    white.data[i].color = (1, 1, 1, 1)
    mask.data[i].color = (r, g, b, 1)

# Scale and re-centre in glTF axes (Blender: x, -z, y).
offset = Vector((centre.x, -centre.z, centre.y))
for v in mesh.vertices:
    v.co = (v.co - offset) * scale
mesh.update()

# A texture wired to the material's Alpha is always exported as PNG. When its alpha is solid
# (the usual case: an imported BLEND material over an opaque photo), unwire it so JPEG applies.
for material in bpy.data.materials:
    if not material.use_nodes:
        continue
    for link in list(material.node_tree.links):
        image = getattr(link.from_node, 'image', None)
        if link.to_socket.identifier == 'Alpha' and image and image.size[0]:
            if min(image.pixels[3::4]) >= 1.0:
                material.node_tree.links.remove(link)

bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format='GLB',
    use_selection=True,
    export_vertex_color='NAME',
    export_vertex_color_name='Col',
    export_all_vertex_colors=True,
    export_yup=True,
    # JPEG by default: photo textures with solid alpha shrink several times over PNG (check the
    # alpha first; fish render opaque unless the species sets model.alphaBlend).
    export_image_format=option('--images', 'JPEG'),
)
print(f'half span {half:.3f} -> {SPAN / 2:.3f} (scale {scale:.4f}); tail root z {tail_root:.3f}, '
      f'centre z {centre.z:.3f}; {len(points)} vertices, '
      f'{sum(1 for m in masks if m[2] > 0)} tail, {sum(1 for m in masks if m[0] > 0)} wing')
