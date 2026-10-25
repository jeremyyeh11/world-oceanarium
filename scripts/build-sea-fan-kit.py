# Builds the sea fan kit (Annella mollis) from Jeremy's sea fan GLB, headless, without touching an
# open Blender scene:
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#     --python scripts/build-sea-fan-kit.py -- <source.glb> public [preview-dir]
#
# The model contract is docs/procedural/coral-sway.md. Each top-level object of the source (with
# its children) is one fan: trunk and main branches as low-poly tubes, the fine lattice as a
# subdivided plane cut out by its texture's alpha (a Math node set to Round between the
# texture's alpha and the Principled BSDF's Alpha, which the glTF exporter writes as alphaMode
# MASK). Each fan's parts are joined into one mesh (one primitive per material), its transforms
# applied, welded, turned so its lattice lies across Blender's Y axis (facing front view) if it
# was modelled side-on, and moved so its origin is its holdfast: the middle of the lowest 4 cm,
# at its lowest z. Fans are named fan0, fan1, ... tallest first.
#
# Writes <out>/models/landscape/sea-fans.glb (every fan, for the tank) and
# <out>/models/fish/annella-mollis/annella-mollis.glb (fan0 alone, the Atlas specimen), with the
# source's materials and textures (PNG, alpha kept; any image over MAX_TEXTURE px is scaled
# down). Prints each fan's size, triangles and materials, and warns where the contract is broken.

import bpy, bmesh, sys, os
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index('--') + 1:]
src, out_dir = args[0], os.path.abspath(args[1])
preview_dir = args[2] if len(args) > 2 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene

# Contract limits (docs/procedural/coral-sway.md).
MAX_TRIANGLES = 3000
MAX_TEXTURE = 2048
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

def alpha_rounded(mat):
    # Whether the material's alpha passes through a Round (or Less Than) Math node: alphaMode MASK.
    if not mat or not mat.use_nodes:
        return False
    return any(n.type == 'MATH' and n.operation in ('ROUND', 'LESS_THAN') for n in mat.node_tree.nodes)

roots = [o for o in scene.objects if o.parent is None and any(d.type == 'MESH' for d in descendants(o))]
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
    # The lattice is the fan's thinnest extent; it should be across Y (the front view looks
    # along +Y). Modelled across X instead, turn it a quarter round Z.
    d = fan.dimensions
    if d.x < d.y and d.x < d.z:
        fan.data.transform(Matrix.Rotation(1.5708, 4, 'Z'))
        warnings.append(f'{root.name}: lattice was across X; turned 90 degrees to face front view')
    elif d.z < d.x and d.z < d.y:
        warnings.append(f'{root.name}: thinnest along Z (lying flat?); expected upright, facing front view')
    # Origin at the holdfast: the middle of the lowest 4 cm, at the lowest z.
    verts = [v.co.copy() for v in fan.data.vertices]
    min_z = min(v.z for v in verts)
    foot = [v for v in verts if v.z < min_z + 0.04]
    base = Vector((sum(v.x for v in foot) / len(foot), sum(v.y for v in foot) / len(foot), min_z))
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

for image in bpy.data.images:
    if image.size[0] > MAX_TEXTURE or image.size[1] > MAX_TEXTURE:
        k = MAX_TEXTURE / max(image.size)
        image.scale(int(image.size[0] * k), int(image.size[1] * k))
        print('TEX scaled', image.name, tuple(image.size))
    elif image.size[0]:
        print('TEX', image.name, tuple(image.size))

kept = [fan for _, fan in fans]
for o in list(scene.objects):
    if o not in kept:
        bpy.data.objects.remove(o, do_unlink=True)

def export(objs, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    select_only(objs, objs[0])
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_materials='EXPORT',
                              export_image_format='AUTO', export_texcoords=True, export_normals=True,
                              export_yup=True, export_animations=False)
    print('GLB', path, os.path.getsize(path))

export(kept, os.path.join(out_dir, 'models', 'landscape', 'sea-fans.glb'))
export(kept[:1], os.path.join(out_dir, 'models', 'fish', 'annella-mollis', 'annella-mollis.glb'))

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
