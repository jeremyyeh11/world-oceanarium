# Builds the giant clam's Atlas specimen: the kit's clam on a low patch of sand, headless, from the
# built kit (scripts/build-giant-clam-kit.py):
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#     --python scripts/build-giant-clam-atlas.py -- public/models/landscape \
#     public/models/fish/tridacna-gigas/tridacna-gigas.glb [preview-dir]
#
# The clam at the kit's size (Jeremy's model, a 1.11 m shell: an adult past the 80 cm common
# length), sunk 3% of its height as the tank sinks it (src/components/giantClamPlacement.js SINK), on
# an oval of sand a little wider than the shell: a low, faceted mound in the tank's sand colour
# (landscapes.js reefs floorColor), so the clam reads as lying on the seabed, not floating. The clam
# keeps the kit's photo materials. Everything in metres, the sand's middle on the origin. Prints the
# specimen's bounds: its largest extent is the Atlas source length (EncyclopediaPage.jsx).

import bpy, bmesh, sys, os, math, random
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
kit_dir, out_path = os.path.abspath(args[0]), os.path.abspath(args[1])
preview_dir = args[2] if len(args) > 2 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# The tank's sand (#c4bea2), in linear light.
SAND = tuple(((c / 255 + 0.055) / 1.055) ** 2.4 for c in (0xc4, 0xbe, 0xa2)) + (1,)
SINK = 0.03
# The sand oval's half-extents round the shell, and its mound's height, in metres.
SAND_MARGIN = (0.3, 0.32)
SAND_RISE = 0.05

bpy.ops.import_scene.gltf(filepath=os.path.join(kit_dir, 'giant-clams.glb'))
clam = bpy.data.objects['clam0']
bpy.context.view_layer.update()
xs = [v.co.x for v in clam.data.vertices]
ys = [v.co.y for v in clam.data.vertices]
zs = [v.co.z for v in clam.data.vertices]
height = max(zs)
clam.location.z = -height * SINK

# A faceted oval of sand: rings of vertices rising gently to the middle, jittered a little.
rx = (max(xs) - min(xs)) / 2 + SAND_MARGIN[0]
ry = (max(ys) - min(ys)) / 2 + SAND_MARGIN[1]
rand = random.Random(4127)
bm = bmesh.new()
rings, segments = 4, 28
centre = bm.verts.new((0, 0, SAND_RISE))
grid = []
for r in range(1, rings + 1):
    share = r / rings
    ring = []
    for s in range(segments):
        a = s * 2 * math.pi / segments + (r % 2) * math.pi / segments
        jitter = 1 + (rand.random() - 0.5) * 0.08 * share
        z = SAND_RISE * (1 - share ** 2) + (rand.random() - 0.5) * 0.012 * (1 - share)
        ring.append(bm.verts.new((math.cos(a) * rx * share * jitter, math.sin(a) * ry * share * jitter, z)))
    grid.append(ring)
for s in range(segments):
    bm.faces.new((centre, grid[0][s], grid[0][(s + 1) % segments]))
for r in range(rings - 1):
    inner, outer = grid[r], grid[r + 1]
    for s in range(segments):
        bm.faces.new((inner[s], outer[s], outer[(s + 1) % segments]))
        bm.faces.new((inner[s], outer[(s + 1) % segments], inner[(s + 1) % segments]))
mesh = bpy.data.meshes.new('sand')
bm.to_mesh(mesh)
bm.free()
for p in mesh.polygons:
    p.use_smooth = False
sand = bpy.data.objects.new('sand', mesh)
scene.collection.objects.link(sand)
mat = bpy.data.materials.new('sand')
mat.use_nodes = True
bsdf = mat.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = SAND
bsdf.inputs['Roughness'].default_value = 1
bsdf.inputs['Metallic'].default_value = 0
mesh.materials.append(mat)
# The clam sits on the mound's top.
clam.location.z += SAND_RISE

bpy.context.view_layer.update()
pts = [o.matrix_world @ Vector(c) for o in (clam, sand) for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
print('BOUNDS', tuple(round(v, 3) for v in lo), tuple(round(v, 3) for v in hi), 'largest', round(max(hi - lo), 3), 'm')
print('CLAM', 'length', round(max(xs) - min(xs), 3), 'm; height', round(height, 3), 'm')

if preview_dir:
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 1000, 700
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('w')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.06, 0.14, 0.32, 1)
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3
    sun.rotation_euler = (0.6, 0.2, 0.8)
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.location = (1.4, -2.2, 1.5)
    target = Vector((0, 0, 0.25))
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.filepath = os.path.join(preview_dir, 'giant-clam-atlas.png')
    bpy.ops.render.render(write_still=True)
    print('PREVIEW', scene.render.filepath)
    for o in (cam, sun):
        bpy.data.objects.remove(o, do_unlink=True)

os.makedirs(os.path.dirname(out_path), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
clam.select_set(True)
sand.select_set(True)
bpy.context.view_layer.objects.active = clam
bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=True, export_materials='EXPORT',
                          export_image_format='JPEG', export_image_quality=85, export_texcoords=True,
                          export_normals=True, export_yup=True, export_animations=False, export_morph=False)
print('GLB', out_path, os.path.getsize(out_path))
