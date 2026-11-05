"""Join a turtle's flippers to its body, paint the foil-flap masks, and export it to the contract.

    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
        --python scripts/paint-foil-flap-masks.py -- <in.glb> <out.glb> --shell <front>,<back> \
        [--name chelonia_mydas] [--ramp-end 0.8] [--max-texture 1024]

Jeremy models the turtle with its four flippers as their own objects, `flipper.fore.l/r` and
`flipper.hind.l/r`, each a closed piece with its root pushed into the body; everything else is
the rigid body (docs/procedural/foil-flap.md, Blender contract). This computes the three
COLOR_1 masks from the shapes rather than hand-painting them:

- Span: along each flipper, 0 at its root end (the end farthest from the tip) to 1 at the tip.
- R, fore-flipper stroke weight: smoothstep from the root to `--ramp-end` of the span at which
  the flipper leaves the body, then 1 to the tip. The bend stays inside the body, and the blade
  that shows turns stiff (a ramp out in the open stretched the stand-in's edges by 45%).
- G, fore-flipper twist weight: the span, linear, a hair above 0 at the root (0.002), so the
  runtime can find the shoulder (`foilFlapRig`: the middle of the vertices with 0 < G < 0.1).
- B, hind-flipper rudder weight: smoothstep to 1 halfway out, a hair above 0 at the root (the
  hip is the middle of the vertices with 0 < B < 0.15).
The body is black: rigid.

It also turns inside-out flippers (negative volume) the right way out, joins all five objects
into one mesh named `--name` (three.js names the per-material parts <name>_1, <name>_2, ...),
crops each photo to the part its faces use and shrinks it to `--max-texture` px (JPEG, solid
alpha), puts the origin at the middle of the shell (`--shell`: the shell's front and back edge on
the midline, in the input's glTF z, nose at -z) and scales the shell to 1 unit, writes a white
COLOR_0, and exports. Prints each flipper's root, tip, and where it leaves the body. The input
file is never modified. Nose must already face -Z.
"""
import math
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:]
src, dst = argv[0], argv[1]
def option(name, default):
    return type(default)(argv[argv.index(name) + 1]) if name in argv else default
if '--shell' not in argv:
    sys.exit('--shell <front>,<back> is required: the shell edges on the midline, glTF z')
SHELL_FRONT, SHELL_BACK = (float(x) for x in option('--shell', '').split(','))
NAME = option('--name', 'chelonia_mydas')
RAMP_END = option('--ramp-end', 0.8)
MAX_TEXTURE = option('--max-texture', 1024)
CROP_MARGIN = 0.01
FLIPPERS = {'flipper.fore.l': 'fore', 'flipper.fore.r': 'fore', 'flipper.hind.l': 'hind', 'flipper.hind.r': 'hind'}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = {o.name: o for o in bpy.context.scene.objects if o.type == 'MESH'}
missing = [n for n in FLIPPERS if n not in meshes]
if missing:
    sys.exit(f'missing flipper objects {missing}; found {sorted(meshes)}')
bodies = [o for n, o in meshes.items() if n not in FLIPPERS]
if not bodies:
    sys.exit('no body object: everything other than the four flippers is the body')

for o in bpy.context.scene.objects:
    o.select_set(o.type == 'MESH')
bpy.context.view_layer.objects.active = bodies[0]
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def smoothstep(edge, x):
    t = max(0.0, min(1.0, x / edge))
    return t * t * (3 - 2 * t)

# Each object the right way out: an inside-out export has a negative signed volume (measured on
# a welded copy, since a flat-shaded import splits every face's vertices).
for o in meshes.values():
    bm = bmesh.new()
    bm.from_mesh(o.data)
    welded = bm.copy()
    bmesh.ops.remove_doubles(welded, verts=welded.verts, dist=1e-5)
    if welded.calc_volume(signed=True) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
        bm.to_mesh(o.data)
        print('INSIDE OUT', o.name, 'faces reversed')
    welded.free()
    bm.free()
    if o.data.has_custom_normals:
        bpy.context.view_layer.objects.active = o
        bpy.ops.mesh.customdata_custom_splitnormals_clear()

# Inside the body: odd number of crossings along a ray (the body is closed).
tree_bm = bmesh.new()
for b in bodies:
    tree_bm.from_mesh(b.data)
tree = BVHTree.FromBMesh(tree_bm)
RAY = Vector((0.0123, 0.9999, 0.0071)).normalized()
def inside(p):
    hits, origin = 0, Vector(p)
    while hits < 64:
        location = tree.ray_cast(origin, RAY)[0]
        if location is None:
            break
        hits += 1
        origin = location + RAY * 1e-5
    return hits % 2 == 1

# Masks per object, per vertex, before joining (the join keeps vertex order per object).
masks = {}
for b in bodies:
    masks[b.name] = [(0.0, 0.0, 0.0)] * len(b.data.vertices)
for name, kind in FLIPPERS.items():
    o = meshes[name]
    points = [v.co.copy() for v in o.data.vertices]
    centre = sum(points, Vector()) / len(points)
    # The tip is the vertex farthest from the body's midline; the root end is the flipper's
    # farthest vertex from the tip.
    tip = max(points, key=lambda p: Vector((p.x, 0, 0)).length + (p - centre).length * 0.001)
    if kind == 'hind':
        tip = max(points, key=lambda p: (p - Vector((0, 0, 0))).length)
    root = max(points, key=lambda p: (p - tip).length)
    axis = tip - root
    span = [max(0.0, min(1.0, (p - root).dot(axis) / axis.length_squared)) for p in points]
    buried = [s for p, s in zip(points, span) if inside(p)]
    exit_span = float(np.percentile(buried, 95)) if buried else 0.0
    out = []
    for s in span:
        if kind == 'fore':
            out.append((smoothstep(max(1e-3, exit_span * RAMP_END), s), max(0.002, s), 0.0))
        else:
            out.append((0.0, 0.0, max(0.002, smoothstep(0.5, s))))
    masks[name] = out
    print('FLIPPER', name, 'root', [round(c, 3) for c in root], 'tip', [round(c, 3) for c in tip],
          f'leaves the body at span {exit_span:.3f}; {len(buried)} of {len(points)} vertices inside')

for o in meshes.values():
    mesh = o.data
    for attribute in list(mesh.color_attributes):
        mesh.color_attributes.remove(attribute)
    mask = mesh.color_attributes.new('mask', 'FLOAT_COLOR', 'POINT')
    for i, (r, g, b) in enumerate(masks[o.name]):
        mask.data[i].color = (r, g, b, 1)

# Join into the body.
body = bodies[0]
for o in bpy.context.scene.objects:
    o.select_set(o.type == 'MESH')
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
mesh = body.data
body.name = mesh.name = NAME
white = mesh.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
for i in range(len(mesh.vertices)):
    white.data[i].color = (1, 1, 1, 1)

# Crop each photo to what its faces use, shrink it, and remap the UVs: one plain material per
# photo, named after its part.
uv = mesh.uv_layers.active.data
def image_node(material):
    if not material or not material.use_nodes:
        return None
    return next((n for n in material.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image), None)
used = {}
for p in mesh.polygons:
    node = image_node(mesh.materials[p.material_index])
    if not node:
        sys.exit(f'a face uses {mesh.materials[p.material_index].name}, which has no image')
    b = used.setdefault(node.image.name, [1e9, 1e9, -1e9, -1e9, set()])
    for li in p.loop_indices:
        u, v = uv[li].uv
        b[0] = min(b[0], u); b[1] = min(b[1], v); b[2] = max(b[2], u); b[3] = max(b[3], v)
    b[4].add(mesh.vertices[p.vertices[0]].co.z)
crops, materials = {}, {}
for name, (u0, v0, u1, v1, _) in used.items():
    image = bpy.data.images[name]
    w, h = image.size
    px = np.empty(w * h * 4, dtype=np.float32)
    image.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    if px[..., 3].min() < 1.0:
        print('WARNING', name, 'has alpha below 1; exported opaque')
    u0, v0 = max(0.0, u0 - CROP_MARGIN), max(0.0, v0 - CROP_MARGIN)
    u1, v1 = min(1.0, u1 + CROP_MARGIN), min(1.0, v1 + CROP_MARGIN)
    x0, y0, x1, y1 = int(u0 * w), int(v0 * h), int(math.ceil(u1 * w)), int(math.ceil(v1 * h))
    cut_px = px[y0:y1, x0:x1].copy()
    cut_px[..., 3] = 1.0
    cw, ch = x1 - x0, y1 - y0
    cut = bpy.data.images.new(f'{NAME}-{len(crops)}', cw, ch, alpha=False)
    cut.pixels.foreach_set(cut_px.ravel())
    scale = min(1.0, MAX_TEXTURE / max(cw, ch))
    if scale < 1:
        cut.scale(max(1, round(cw * scale)), max(1, round(ch * scale)))
    cut.file_format = 'JPEG'
    crops[name] = (x0 / w, y0 / h, x1 / w, y1 / h)
    mat = bpy.data.materials.new(f'{NAME}-{len(materials)}')
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.9
    bsdf.inputs['Metallic'].default_value = 0
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = cut
    links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    materials[name] = mat
    print('IMAGE', name, f'{w}x{h}', 'used', [round(c, 3) for c in crops[name]], '->',
          f'{cut.size[0]}x{cut.size[1]}', mat.name)
old = list(mesh.materials)
names = list(used)
remap = []
for p in mesh.polygons:
    node = image_node(old[p.material_index])
    cu0, cv0, cu1, cv1 = crops[node.image.name]
    for li in p.loop_indices:
        u, v = uv[li].uv
        uv[li].uv = ((u - cu0) / (cu1 - cu0), (v - cv0) / (cv1 - cv0))
    remap.append(names.index(node.image.name))
mesh.materials.clear()
for n in names:
    mesh.materials.append(materials[n])
for p, index in zip(mesh.polygons, remap):
    p.material_index = index

# Origin at the middle of the shell, shell 1 unit long. glTF z is Blender -y.
shell_length = SHELL_BACK - SHELL_FRONT
zs = [v.co.z for v in mesh.vertices]
offset = Vector((0.0, -(SHELL_FRONT + SHELL_BACK) / 2, (min(zs) + max(zs)) / 2))
for v in mesh.vertices:
    v.co = (v.co - offset) / shell_length
mesh.update()

for o in bpy.context.scene.objects:
    o.select_set(o == body)
bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format='GLB',
    use_selection=True,
    export_vertex_color='NAME',
    export_vertex_color_name='Col',
    export_all_vertex_colors=True,
    export_yup=True,
    export_image_format='JPEG',
)
ys = [v.co for v in mesh.vertices]
print(f'shell {shell_length:.4f} source units -> 1; centre {tuple(round(c, 4) for c in offset)}; '
      f'{len(mesh.vertices)} vertices, nose to rear '
      f'{max(v.y for v in ys) - min(v.y for v in ys):.4f}, width {max(v.x for v in ys) - min(v.x for v in ys):.4f}')
