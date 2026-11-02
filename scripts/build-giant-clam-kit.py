# Builds the giant clam kit (Tridacna gigas) from Jeremy's clam GLB, headless, without touching an
# open Blender scene:
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#     --python scripts/build-giant-clam-kit.py -- <source.glb> public/models/landscape [preview-dir]
#
# Model contract (docs/species-preparation.md, Giant Clam, GLB contract): one open clam, its shell
# and mantle on separate materials, at real size in metres (1 unit = 1 m), up +Y in glTF, with its
# object origin at the middle of the shell's underside, where it rests on the sand. Photo textures,
# one UV map. No bones, clips, shape keys or vertex colour: the clam is static.
#
# His export (2026-11-02) is one object of two materials, the mantle (Bernard Dupont's Commons
# photo) and the shell (Andrew Green's Reef Life Survey photo), about 10,300 triangles, the shell's
# length along glTF Z. Here the object's transform is baked into its mesh about its origin, and the
# clam is turned a quarter about its up so its length runs along X, as the placement and the Atlas
# expect. Every material is rebuilt opaque and named for its part (`mantle`, `shell`, by which of
# the two sits higher: the mantle crowns the gape). Each photo is cut to the part its faces use and
# scaled to at most MAX_TEXTURE px, written as JPEG inside the GLB. The Reef Life Survey watermark in
# the shell photo's bottom-right corner (outside the shell's UVs) is filled with the colour above it
# first, so none of it ships. The output object is `clam0`, matching landscapes.js GIANT_CLAM_KIT. It
# prints one line per part and image, and warns where the contract is broken.

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
MAX_TRIANGLES = 12000
# A shell 60 cm to 1.4 m long in the source (real size); placement scales it anyway.
SIZE_RANGE = (0.6, 1.4)
# Texels kept round the used part of a photo, so mip levels do not bleed in the cut edge.
CROP_MARGIN = 0.02
# The watermark's corner of a Reef Life Survey photo, as shares of the image from its bottom-right
# (Blender rows run bottom up): the "reeflifesurvey.com" text sits in the right 19% and bottom 4.5%.
WATERMARK = {'right': 0.2, 'bottom': 0.05, 'match': 'species_'}

warnings = []

def tri_count(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)

def image_node(mat):
    nodes = [n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image] if mat and mat.use_nodes else []
    return nodes[0] if nodes else None

objects = [o for o in scene.objects if o.type == 'MESH']
if len(objects) != 1:
    warnings.append(f'{len(objects)} mesh objects: expected one clam')
obj = max(objects, key=lambda o: len(o.data.polygons))
for o in objects:
    if o is not obj:
        warnings.append(f'{o.name} dropped (one object per clam)')

# Bake the transform about the origin (the underside's middle), then turn the length onto X.
origin = obj.matrix_world.translation.copy()
if origin.length > 1e-4:
    warnings.append(f'{obj.name} origin is off the world origin at {tuple(round(v, 3) for v in origin)} (fine: it is the rest point)')
obj.data = obj.data.copy()
obj.data.transform(Matrix.Translation(-origin) @ obj.matrix_world)
obj.matrix_world.identity()
me = obj.data
xs = [v.co.x for v in me.vertices]
ys = [v.co.y for v in me.vertices]
if max(ys) - min(ys) > max(xs) - min(xs):
    me.transform(Matrix.Rotation(-math.pi / 2, 4, 'Z'))
me.update()
xs = [v.co.x for v in me.vertices]
ys = [v.co.y for v in me.vertices]
zs = [v.co.z for v in me.vertices]
length, width, height = max(xs) - min(xs), max(ys) - min(ys), max(zs)
if me.shape_keys:
    warnings.append('shape keys (dropped)')
if me.color_attributes:
    warnings.append('vertex colour (ignored)')
if min(zs) < -0.05:
    warnings.append(f'reaches {round(-min(zs), 3)} m below its origin: the origin should be under the shell')
if tri_count(me) > MAX_TRIANGLES:
    warnings.append(f'{tri_count(me)} triangles (budget {MAX_TRIANGLES})')
if not SIZE_RANGE[0] <= length <= SIZE_RANGE[1]:
    warnings.append(f'shell {round(length, 2)} m long: not at real size?')
while len(me.uv_layers) > 1:
    me.uv_layers.remove(me.uv_layers[-1])
uv = me.uv_layers[0].data

# Which photo each face samples, the part of it the faces use, and how high its faces sit.
used = {}
tops = {}
for p in me.polygons:
    node = image_node(me.materials[p.material_index])
    if not node:
        warnings.append(f'a face uses {me.materials[p.material_index].name}, which has no image')
        continue
    b = used.setdefault(node.image.name, [1e9, 1e9, -1e9, -1e9])
    for li in p.loop_indices:
        u, v = uv[li].uv
        b[0] = min(b[0], u); b[1] = min(b[1], v); b[2] = max(b[2], u); b[3] = max(b[3], v)
    tops[node.image.name] = max(tops.get(node.image.name, -1e9), max(me.vertices[i].co.z for i in p.vertices))
if len(used) != 2:
    warnings.append(f'{len(used)} photos: expected the mantle and the shell')
# The mantle crowns the gape, so its photo's faces reach highest.
mantle_image = max(tops, key=tops.get)

materials = {}
crops = {}
# The source's own materials step aside, so the rebuilt ones get the plain part names.
for mat in list(me.materials):
    if mat:
        mat.name = f'source-{mat.name}'
for name, (u0, v0, u1, v1) in used.items():
    image = bpy.data.images[name]
    w, h = image.size
    px = np.array(image.pixels[:], dtype=np.float32).reshape(h, w, 4)
    if WATERMARK['match'] in name:
        # Fill the watermark corner with the mean colour of the band just above it.
        x0, y1 = int(w * (1 - WATERMARK['right'])), int(math.ceil(h * WATERMARK['bottom']))
        band = px[y1:y1 + max(2, y1 // 2), x0:].reshape(-1, 4).mean(axis=0)
        px[:y1, x0:] = band
        print('WATERMARK', name, f'filled x >= {x0}, rows < {y1}')
    u0, v0 = max(0.0, u0 - CROP_MARGIN), max(0.0, v0 - CROP_MARGIN)
    u1, v1 = min(1.0, u1 + CROP_MARGIN), min(1.0, v1 + CROP_MARGIN)
    x0, y0, x1, y1 = int(u0 * w), int(v0 * h), int(math.ceil(u1 * w)), int(math.ceil(v1 * h))
    cut_px = px[y0:y1, x0:x1].copy()
    cut_px[..., 3] = 1.0
    part = 'mantle' if name == mantle_image else 'shell'
    cw, ch = x1 - x0, y1 - y0
    cut = bpy.data.images.new(part, cw, ch, alpha=False)
    cut.pixels.foreach_set(cut_px.ravel())
    scale = min(1.0, MAX_TEXTURE / max(cw, ch))
    if scale < 1:
        cut.scale(max(1, round(cw * scale)), max(1, round(ch * scale)))
    cut.file_format = 'JPEG'
    crops[name] = (x0 / w, y0 / h, x1 / w, y1 / h)
    mat = bpy.data.materials.new(part)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.9
    bsdf.inputs['Metallic'].default_value = 0
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = cut
    links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    materials[name] = mat
    print('IMAGE', part, name, f'{w}x{h}', 'used', [round(c, 3) for c in crops[name]], '->', f'{cut.size[0]}x{cut.size[1]}')

# Every face in its photo's cut, with the photo's new material: the mantle first.
old = list(me.materials)
names = sorted(used, key=lambda n: n != mantle_image)
remap = []
for p in me.polygons:
    node = image_node(old[p.material_index])
    if not node:
        remap.append(None)
        continue
    cu0, cv0, cu1, cv1 = crops[node.image.name]
    for li in p.loop_indices:
        u, v = uv[li].uv
        uv[li].uv = ((u - cu0) / (cu1 - cu0), (v - cv0) / (cv1 - cv0))
    remap.append(node.image.name)
me.materials.clear()
for n in names:
    me.materials.append(materials[n])
for p, r in zip(me.polygons, remap):
    p.material_index = names.index(r) if r else 0
obj.name = me.name = 'clam0'
for n in names:
    faces = sum(1 for r in remap if r == n)
    print('PART', materials[n].name, faces, 'faces')
print('CLAM', obj.name, 'length', round(length, 3), 'm; width', round(width, 3), 'm; height', round(height, 3),
      'm; below origin', round(max(0.0, -min(zs)), 3), 'm;', tri_count(me), 'triangles')

if preview_dir:
    # The clam from the front, the end and three-quarter above.
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 1500, 600
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('w')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.06, 0.14, 0.32, 1)
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3
    sun.rotation_euler = (0.6, 0.2, 0.8)
    scene.collection.objects.link(sun)
    shown = []
    for i, (spin, tilt) in enumerate([(0, 0), (math.pi / 2, 0), (math.pi / 5, 0.5)]):
        show = obj.copy()
        show.location.x = i * (length + 0.3)
        # The glTF importer leaves objects in quaternion mode.
        show.rotation_mode = 'XYZ'
        show.rotation_euler = (tilt, 0, spin)
        scene.collection.objects.link(show)
        shown.append(show)
    obj.hide_render = True
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 3 * (length + 0.3)
    cam.location = (length + 0.3, -6, height / 2 + 0.6)
    cam.rotation_euler = (math.radians(84), 0, 0)
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.filepath = os.path.join(preview_dir, 'giant-clam-kit.png')
    bpy.ops.render.render(write_still=True)
    print('PREVIEW', scene.render.filepath)
    for o in shown:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    bpy.data.objects.remove(sun, do_unlink=True)
    obj.hide_render = False

bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
glb = os.path.join(out_dir, 'giant-clams.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_materials='EXPORT',
                          export_image_format='JPEG', export_image_quality=85, export_texcoords=True,
                          export_normals=True, export_yup=True, export_animations=False, export_morph=False)
print('GLB', glb, os.path.getsize(glb))
for w in warnings:
    print('WARNING', w)
