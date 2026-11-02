# Builds the leather coral kit (Sarcophyton glaucum) from Jeremy's toadstool GLB, headless, without
# touching an open Blender scene:
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#     --python scripts/build-leather-coral-kit.py -- <source.glb> public/models/landscape [preview-dir]
#
# Model contract (docs/procedural/coral-sway.md, Blender contract: leather coral): each colony is one
# mesh object, a cap (or two heads) joined to its stalk, at real size in metres (1 unit = 1 m), up
# +Y in glTF, with its object origin at the bottom of the stalk, in the middle: the holdfast, where
# it meets the rock (a coral's origin is its root, never a computed lowest point). Photo textures,
# any number of materials and UV maps (Jeremy's stalks and cap undersides sample a second UV map,
# 2026-11-02). No bones, clips, shape keys or vertex colour: the sway is a vertex shader
# (src/utils/coralSway.js) whose attributes are baked at placement.
#
# Unlike the table, brain and cauliflower kits nothing is decimated or baked: his toadstools are
# already low-poly (878 to 2,748 triangles), and their look is the photo. Each colony's transform is
# baked into its mesh about its origin, which stays at (0, 0, 0). Every material is rebuilt opaque
# (his export was Blend, which draws the far side through the near), and every face is moved onto
# the first UV map, so the runtime needs one. Each photo is cut to the part its faces use and
# scaled to at most MAX_TEXTURE px, written as JPEG inside the GLB. Colonies are named leather0,
# leather1, ... tallest first; the output names match landscapes.js LEATHER_CORAL_KIT. It prints
# one line per colony and image, and warns where the contract is broken.

import bpy, sys, os, math
import numpy as np
from mathutils import Matrix

args = sys.argv[sys.argv.index('--') + 1:]
src, out_dir = args[0], os.path.abspath(args[1])
preview_dir = args[2] if len(args) > 2 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene
os.makedirs(out_dir, exist_ok=True)

MAX_TEXTURE = 1024
MAX_TRIANGLES = 3000
# Colonies 30 to 80 cm tall or across in the source (real size); placement scales them anyway.
SIZE_RANGE = (0.2, 1.2)
# Texels kept round the used part of a photo, so mip levels do not bleed in the cut edge.
CROP_MARGIN = 0.02

warnings = []

def tri_count(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)

def image_node(mat):
    nodes = [n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image] if mat and mat.use_nodes else []
    return nodes[0] if nodes else None

def uv_layer_of(node, mesh):
    # The UV map an image node samples: a UV Map node's, else the mesh's first.
    links = node.inputs['Vector'].links
    while links:
        from_node = links[0].from_node
        if from_node.type == 'UVMAP' and from_node.uv_map:
            return from_node.uv_map
        links = from_node.inputs[0].links if from_node.inputs else []
    return mesh.uv_layers[0].name

sources = [o for o in scene.objects if o.type == 'MESH' and o.parent is None]
for o in scene.objects:
    if o.type == 'MESH' and o.parent is not None:
        warnings.append(f'{o.name} is parented to {o.parent.name}: one object per colony')

# Bake each colony's transform about its origin (the holdfast), then measure it.
colonies = []
for obj in sources:
    origin = obj.matrix_world.translation.copy()
    if origin.length > 1e-4:
        warnings.append(f'{obj.name} origin is off the world origin at {tuple(round(v, 3) for v in origin)} (fine: it is the holdfast)')
    obj.data = obj.data.copy()
    obj.data.transform(Matrix.Translation(-origin) @ obj.matrix_world)
    obj.matrix_world.identity()
    obj.data.update()
    me = obj.data
    zs = [v.co.z for v in me.vertices]
    height = max(zs)
    reach = max(math.hypot(v.co.x, v.co.y) for v in me.vertices)
    colonies.append((height, obj))
    if me.shape_keys:
        warnings.append(f'{obj.name} has shape keys (dropped)')
    if me.color_attributes:
        warnings.append(f'{obj.name} has vertex colour (ignored)')
    if min(zs) < -0.02:
        warnings.append(f'{obj.name} reaches {round(-min(zs), 3)} m below its origin: the origin should be the bottom of the stalk')
    if tri_count(me) > MAX_TRIANGLES:
        warnings.append(f'{obj.name} has {tri_count(me)} triangles (budget {MAX_TRIANGLES})')
    if not SIZE_RANGE[0] <= max(height, reach * 2) <= SIZE_RANGE[1]:
        warnings.append(f'{obj.name} is {round(max(height, reach * 2), 2)} m: not at real size?')
colonies.sort(key=lambda c: -c[0])

# Which photo and UV map each face samples, and the part of each photo the faces use.
used = {}
for _, obj in colonies:
    me = obj.data
    for p in me.polygons:
        node = image_node(me.materials[p.material_index])
        if not node:
            warnings.append(f'{obj.name} face uses {me.materials[p.material_index].name}, which has no image')
            continue
        layer = me.uv_layers[uv_layer_of(node, me)].data
        b = used.setdefault(node.image.name, [1e9, 1e9, -1e9, -1e9])
        for li in p.loop_indices:
            u, v = layer[li].uv
            b[0] = min(b[0], u); b[1] = min(b[1], v); b[2] = max(b[2], u); b[3] = max(b[3], v)

# Each photo cut to its used part (plus a margin) and scaled down: one opaque material per photo.
materials = {}
crops = {}
for name, (u0, v0, u1, v1) in used.items():
    image = bpy.data.images[name]
    w, h = image.size
    u0, v0 = max(0.0, u0 - CROP_MARGIN), max(0.0, v0 - CROP_MARGIN)
    u1, v1 = min(1.0, u1 + CROP_MARGIN), min(1.0, v1 + CROP_MARGIN)
    if u0 < 0 or v0 < 0 or u1 > 1 or v1 > 1:
        warnings.append(f'{name}: UVs run outside the image (tiled?)')
    x0, y0, x1, y1 = int(u0 * w), int(v0 * h), int(math.ceil(u1 * w)), int(math.ceil(v1 * h))
    px = np.array(image.pixels[:], dtype=np.float32).reshape(h, w, 4)[y0:y1, x0:x1].copy()
    px[..., 3] = 1.0
    cw, ch = x1 - x0, y1 - y0
    cut = bpy.data.images.new(f'leather-{len(crops)}', cw, ch, alpha=False)
    cut.pixels.foreach_set(px.ravel())
    scale = min(1.0, MAX_TEXTURE / max(cw, ch))
    if scale < 1:
        cut.scale(max(1, round(cw * scale)), max(1, round(ch * scale)))
    cut.file_format = 'JPEG'
    crops[name] = (x0 / w, y0 / h, x1 / w, y1 / h)
    mat = bpy.data.materials.new(cut.name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.9
    bsdf.inputs['Metallic'].default_value = 0
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = cut
    links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    materials[name] = mat
    print('IMAGE', name, f'{w}x{h}', 'used', [round(c, 3) for c in crops[name]], '->', cut.name, f'{cut.size[0]}x{cut.size[1]}')

# Every face onto the first UV map, in its photo's cut, with the photo's new material.
for index, (height, obj) in enumerate(colonies):
    me = obj.data
    first = me.uv_layers[0].data
    old = list(me.materials)
    nodes = [image_node(m) for m in old]
    layers = [me.uv_layers[uv_layer_of(n, me)].data if n else None for n in nodes]
    remap = []
    for p in me.polygons:
        node = nodes[p.material_index]
        if not node:
            remap.append(None)
            continue
        cu0, cv0, cu1, cv1 = crops[node.image.name]
        layer = layers[p.material_index]
        for li in p.loop_indices:
            u, v = layer[li].uv
            first[li].uv = ((u - cu0) / (cu1 - cu0), (v - cv0) / (cv1 - cv0))
        remap.append(node.image.name)
    while len(me.uv_layers) > 1:
        me.uv_layers.remove(me.uv_layers[-1])
    names = sorted({r for r in remap if r})
    me.materials.clear()
    for n in names:
        me.materials.append(materials[n])
    for p, r in zip(me.polygons, remap):
        p.material_index = names.index(r) if r else 0
    obj.name = obj.data.name = f'leather{index}'
    zs = [v.co.z for v in me.vertices]
    reach = max(math.hypot(v.co.x, v.co.y) for v in me.vertices)
    print('COLONY', obj.name, 'height', round(height, 3), 'm; reach about the holdfast', round(reach, 3),
          'm; below origin', round(max(0.0, -min(zs)), 3), 'm;', tri_count(me), 'triangles;', 'images', names)

for o in list(scene.objects):
    if o not in [c[1] for c in colonies]:
        bpy.data.objects.remove(o, do_unlink=True)

if preview_dir:
    # The colonies side by side, from the front and a little above.
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 1600, 700
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('w')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.06, 0.14, 0.32, 1)
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3
    sun.rotation_euler = (0.6, 0.2, 0.8)
    scene.collection.objects.link(sun)
    x = 0.0
    shown = []
    for _, obj in colonies:
        show = obj.copy()
        lo = min(v.co.x for v in obj.data.vertices)
        hi = max(v.co.x for v in obj.data.vertices)
        show.location.x = x - lo
        x += hi - lo + 0.2
        scene.collection.objects.link(show)
        shown.append(show)
        obj.hide_render = True
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = x + 0.2
    cam.location = ((x - 0.2) / 2, -6, 2.4)
    cam.rotation_euler = (math.radians(70), 0, 0)
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.filepath = os.path.join(preview_dir, 'leather-coral-kit.png')
    bpy.ops.render.render(write_still=True)
    print('PREVIEW', scene.render.filepath)
    for o in shown:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    bpy.data.objects.remove(sun, do_unlink=True)
    for _, obj in colonies:
        obj.hide_render = False

bpy.ops.object.select_all(action='DESELECT')
for _, obj in colonies:
    obj.select_set(True)
bpy.context.view_layer.objects.active = colonies[0][1]
glb = os.path.join(out_dir, 'leather-corals.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_materials='EXPORT',
                          export_image_format='JPEG', export_image_quality=85, export_texcoords=True,
                          export_normals=True, export_yup=True, export_animations=False, export_morph=False)
print('GLB', glb, os.path.getsize(glb), 'colonies', len(colonies))
for w in warnings:
    print('WARNING', w)
