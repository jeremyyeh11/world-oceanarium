# Builds the sea fan kit (Annella mollis) from Jeremy's sea fan GLB, headless, without touching an
# open Blender scene:
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#     --python scripts/build-sea-fan-kit.py -- <source.glb> public [preview-dir] \
#     [--alpha=<image key>=<mask>] ...
#
# Each --alpha replaces the alpha of the lattice image whose name contains <image key> (any case)
# with a black and white mask (white solid), scaled to the image. Jeremy's masks for his first
# fans (2026-10-26: the fans read "too see through", wanting "volume") are beside the source:
#   --alpha="orange=<dir>/annella mollis alpha orange.jpg"
#   --alpha="pink=<dir>/annella mollis alpha pink.jpg"
#   --alpha="coral_(annella=<dir>/annella mollis alpha yellow.jpg"
#
# The model contract is docs/procedural/coral-sway.md. Each top-level object of the source (with
# its children) is one fan: trunk and main branches as low-poly tubes, the fine lattice as a
# subdivided plane cut out by its texture's alpha (a Math node set to Round between the
# texture's alpha and the Principled BSDF's Alpha, which the glTF exporter writes as alphaMode
# MASK; a lattice exported as Blend, its alpha wired straight in, gets the Round node here). Each
# fan's parts are joined into one mesh (one primitive per material), its transforms applied,
# welded, turned so its lattice lies across Blender's Y axis (facing front view) if it was
# modelled side-on or lying flat (Jeremy's first fans, 2026-10-26, lay in the XY plane), and
# turned so it grows up +Z from its holdfast. The holdfast is each source object's origin, which
# Jeremy sets at the root of the trunk; the fan is moved so it is the origin. Fans are named
# fan0, fan1, ... tallest first.
#
# Writes <out>/models/landscape/sea-fans.glb (every fan, for the tank; the Atlas specimen is built
# from it by scripts/build-sea-fan-atlas.py), with the
# source's materials and textures as WebP (alpha kept): a lattice's image scaled down to at most
# MAX_TEXTURE px, an image only the opaque branches use to MAX_BRANCH_TEXTURE (Jeremy's first GLB
# held photo textures up to 4720 px, 76 MB). Prints each fan's size, triangles and materials, and warns where the contract is broken.

import bpy, bmesh, sys, os, math
import numpy as np
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:]
args = [a for a in argv if not a.startswith('--alpha=')]
alpha_masks = [a[len('--alpha='):].split('=', 1) for a in argv if a.startswith('--alpha=')]
src, out_dir = args[0], os.path.abspath(args[1])
preview_dir = args[2] if len(args) > 2 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene

# Contract limits (docs/procedural/coral-sway.md).
MAX_TRIANGLES = 3000
MAX_TEXTURE = 2048
MAX_BRANCH_TEXTURE = 1024
# A fan is 0.3 to 3 m tall in the source (real size, 1 unit = 1 m).
HEIGHT_RANGE = (0.3, 3.0)

warnings = []

def tri_count(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)

def select_only(objs, active):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active

def descendants(obj):
    out = [obj]
    for child in obj.children:
        out += descendants(child)
    return out

def image_alpha_links(mat):
    # Links from an image texture's Alpha (directly) into the Principled BSDF's Alpha.
    if not mat or not mat.use_nodes:
        return []
    return [l for l in mat.node_tree.links
            if l.to_node.type == 'BSDF_PRINCIPLED' and l.to_socket.name == 'Alpha'
            and l.from_node.type == 'TEX_IMAGE' and l.from_socket.name == 'Alpha']

def round_alpha(mat):
    # Blend → Mask: a Round node between the image's alpha and the BSDF's.
    for link in image_alpha_links(mat):
        tree = mat.node_tree
        node = tree.nodes.new('ShaderNodeMath')
        node.operation = 'ROUND'
        src, dst = link.from_socket, link.to_socket
        tree.links.remove(link)
        tree.links.new(src, node.inputs[0])
        tree.links.new(node.outputs[0], dst)
        print('MASK', mat.name, 'alpha rounded (was Blend)')

def alpha_rounded(mat):
    # Whether the material's alpha passes through a Round (or Less Than) Math node: alphaMode MASK.
    if not mat or not mat.use_nodes:
        return False
    return any(n.type == 'MATH' and n.operation in ('ROUND', 'LESS_THAN') for n in mat.node_tree.nodes)

roots = [o for o in scene.objects if o.parent is None and any(d.type == 'MESH' for d in descendants(o))]
for mat in bpy.data.materials:
    round_alpha(mat)

fans = []
for root in roots:
    meshes = [d for d in descendants(root) if d.type == 'MESH']
    # Bake every transform into the meshes, then join them into one object.
    for m in meshes:
        m.data = m.data.copy()
        m.data.transform(m.matrix_world)
        m.parent = None
        m.matrix_world.identity()
    select_only(meshes, meshes[0])
    if len(meshes) > 1:
        bpy.ops.object.join()
    fan = bpy.context.view_layer.objects.active
    bm = bmesh.new()
    bm.from_mesh(fan.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    bm.to_mesh(fan.data)
    bm.free()
    fan.data.update()
    bpy.context.view_layer.update()
    # The holdfast is the source object's origin: Jeremy sets each fan's origin at the root of
    # its trunk (2026-10-26, after the lowest point of the trunk left some fans floating).
    base = root.matrix_world.translation.copy()
    centre = sum((v.co for v in fan.data.vertices), Vector()) / len(fan.data.vertices)
    # The lattice is the fan's thinnest extent; it should be across Y (the front view looks
    # along +Y), the fan growing up +Z from its holdfast. Turn it so: first lay the direction from
    # the holdfast to the fan's middle along the lattice's long axis, then stand it up.
    d = fan.dimensions
    if d.x < d.y and d.x < d.z:
        turn = Matrix.Rotation(1.5708, 4, 'Z')
        print('TURNED', root.name, '(lattice was across X)')
    elif d.z < d.x and d.z < d.y:
        # Lying flat in the XY plane: turn it about its holdfast so it grows along +Y, then +Y up.
        # Of the turns within 70 degrees of holdfast-to-middle, the one leaving the least of the
        # fan below its holdfast: what hangs below it can only go into the rock it grows from
        # (Jeremy's fans hang 8 to 37 cm of lattice below their roots when leaned to their middle).
        grow = centre - base
        aim = math.atan2(-grow.x, grow.y)
        pts = [v.co - base for v in fan.data.vertices]
        def below(angle):
            c, s = math.cos(angle), math.sin(angle)
            # The height of each point along the direction at `angle` from +Y.
            return min(-p.x * s + p.y * c for p in pts)
        best = max((aim + math.radians(k) for k in range(-70, 71, 2)), key=below)
        spin = Matrix.Rotation(-best, 4, 'Z')
        turn = Matrix.Rotation(1.5708, 4, 'X') @ spin
        print('STOOD UP', root.name, '(was lying flat): lowest point', round(below(aim), 3), '->', round(below(best), 3),
              'm below the holdfast, turned', round(math.degrees(best - aim)), 'degrees from its middle')
    else:
        turn = Matrix.Identity(4)
    fan.data.transform(turn)
    base = turn @ base
    centre = turn @ centre
    if (d.y < d.x and d.y < d.z) or (d.x < d.y and d.x < d.z):
        # Upright: lean holdfast-to-middle onto +Z, about Y.
        grow = centre - base
        lean = Matrix.Rotation(math.atan2(-grow.x, grow.z), 4, 'Y')
        fan.data.transform(lean)
        base = lean @ base
    fan.data.update()
    print('HOLDFAST', root.name, 'at its origin', tuple(round(v, 3) for v in base))
    fan.data.transform(Matrix.Translation(-base))
    fan.data.update()
    bpy.context.view_layer.update()
    fans.append((root.name, fan))

fans.sort(key=lambda item: -item[1].dimensions.z)
for i, (source, fan) in enumerate(fans):
    fan.name = fan.data.name = f'fan{i}'
    tris = tri_count(fan.data)
    dims = tuple(round(v, 3) for v in fan.dimensions)
    mats = [(m.name, 'MASK' if alpha_rounded(m) else 'opaque') for m in fan.data.materials]
    print('FAN', fan.name, 'from', source, 'dims', dims, 'tris', tris, 'materials', mats)
    if tris > MAX_TRIANGLES:
        warnings.append(f'{fan.name}: {tris} triangles (budget {MAX_TRIANGLES})')
    if not HEIGHT_RANGE[0] <= fan.dimensions.z <= HEIGHT_RANGE[1]:
        warnings.append(f'{fan.name}: {fan.dimensions.z:.2f} m tall; the source should be real size in metres')
    if not any(kind == 'MASK' for _, kind in mats):
        warnings.append(f'{fan.name}: no material with a Round node on its alpha; the lattice will export opaque')
    if len(fan.data.vertices) < 60:
        warnings.append(f'{fan.name}: only {len(fan.data.vertices)} vertices; the lattice needs subdividing (8 x 8 or more) to bend')

lattice_images = {n.image.name for m in bpy.data.materials if alpha_rounded(m)
                  for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image}
for image in bpy.data.images:
    if not image.size[0]:
        continue
    cap = MAX_TEXTURE if image.name in lattice_images else MAX_BRANCH_TEXTURE
    if max(image.size) > cap:
        k = cap / max(image.size)
        image.scale(int(image.size[0] * k), int(image.size[1] * k))
        print('TEX scaled', image.name, tuple(image.size))
    else:
        print('TEX', image.name, tuple(image.size))

def replace_alpha(image, mask_path):
    w, h = image.size
    mask = bpy.data.images.load(mask_path)
    mask.colorspace_settings.name = 'Non-Color'
    mask.scale(w, h)
    m = np.empty(w * h * 4, dtype=np.float32)
    mask.pixels.foreach_get(m)
    px = np.empty(w * h * 4, dtype=np.float32)
    image.pixels.foreach_get(px)
    before = float((px[3::4] > 0.5).mean())
    px[3::4] = m[0::4]
    image.pixels.foreach_set(px)
    image.update()
    bpy.data.images.remove(mask)
    print('ALPHA', image.name, 'from', os.path.basename(mask_path), 'solid share', round(before, 3), '->', round(float((px[3::4] > 0.5).mean()), 3))

for key, mask_path in alpha_masks:
    matches = [im for im in bpy.data.images if im.name in lattice_images and key.lower() in im.name.lower()]
    if len(matches) != 1:
        warnings.append(f'--alpha {key}: matched {len(matches)} lattice images')
        continue
    replace_alpha(matches[0], mask_path)

kept = [fan for _, fan in fans]
for o in list(scene.objects):
    if o not in kept:
        bpy.data.objects.remove(o, do_unlink=True)

def export(objs, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    select_only(objs, objs[0])
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_materials='EXPORT',
                              export_image_format='WEBP', export_texcoords=True, export_normals=True,
                              export_yup=True, export_animations=False)
    print('GLB', path, os.path.getsize(path))

export(kept, os.path.join(out_dir, 'models', 'landscape', 'sea-fans.glb'))

if preview_dir:
    # The fans side by side from the front, for a look before shipping.
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('w')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.06, 0.14, 0.32, 1)
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3
    sun.rotation_euler = (0.9, 0.2, 0.3)
    scene.collection.objects.link(sun)
    x = 0
    for fan in kept:
        fan.location.x = x + fan.dimensions.x / 2
        x += fan.dimensions.x + 0.3
    tallest = max(f.dimensions.z for f in kept)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = max(x, tallest * 16 / 9) * 1.1
    cam.location = (x / 2, -10, tallest / 2)
    cam.rotation_euler = (1.5708, 0, 0)
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.filepath = os.path.join(preview_dir, 'sea-fan-kit.png')
    bpy.ops.render.render(write_still=True)
    print('PREVIEW', scene.render.filepath)

for w in warnings:
    print('WARNING', w)
print('DONE', len(kept), 'fans,', len(warnings), 'warnings')
