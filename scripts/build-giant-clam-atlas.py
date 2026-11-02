# Builds the giant clam's Atlas specimen: the kit's clam on a low patch of sand, headless, from the
# built kit (scripts/build-giant-clam-kit.py):
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#     --python scripts/build-giant-clam-atlas.py -- public/models/landscape \
#     public/models/fish/tridacna-gigas/tridacna-gigas.glb [preview-dir]
#
# The clam at the kit's size (Jeremy's model, a 1.11 m shell: an adult past the 80 cm common
# length), sunk 3% of its height as the tank sinks it (src/components/giantClamPlacement.js SINK), on
# a faint disc of sand like the table coral's (scripts/build-coral-atlas.py): the tank's sand colour
# with a little grain, toned well down, at most 60% opaque, fading out from 30% of its radius and a
# little darker under the clam (the Atlas draws no shadows), so the clam reads as lying on the
# seabed without a hard patch (Jeremy, 2026-11-02: "match the ... soft gradient"; its alpha needs
# the species' `model.alphaBlend`). The clam keeps the kit's photo materials. Everything in metres,
# the clam's middle on the origin. Prints the clam's and the specimen's bounds.

import bpy, sys, os, math
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
kit_dir, out_path = os.path.abspath(args[0]), os.path.abspath(args[1])
preview_dir = args[2] if len(args) > 2 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

SINK = 0.03
# The sand disc, as the table coral's: texture size, radius (m), tone and greatest opacity.
SAND_SIZE = 256
SAND_RADIUS = 1.6
SAND_TONE = (0.25, 0.25, 0.25)
SAND_ALPHA = 0.6

bpy.ops.import_scene.gltf(filepath=os.path.join(kit_dir, 'giant-clams.glb'))
clam = bpy.data.objects['clam0']
bpy.context.view_layer.update()
xs = [v.co.x for v in clam.data.vertices]
ys = [v.co.y for v in clam.data.vertices]
zs = [v.co.z for v in clam.data.vertices]
height = max(zs)
clam.location.z = -height * SINK

# A faint disc of sand under the clam, generated here so the build needs no extra asset.
clam_reach = max(max(xs) - min(xs), max(ys) - min(ys)) / 2
grain_seed = [12345]


def grain():
    grain_seed[0] = (grain_seed[0] * 1103515245 + 12345) % 2147483648
    return grain_seed[0] / 2147483648 - 0.5


pixels = [0.0] * (SAND_SIZE * SAND_SIZE * 4)
for py in range(SAND_SIZE):
    for px in range(SAND_SIZE):
        u = (px + 0.5) / SAND_SIZE * 2 - 1
        v = (py + 0.5) / SAND_SIZE * 2 - 1
        r = math.hypot(u, v)
        if r > 1:
            continue
        edge = max(0.0, min(1.0, (1 - r) / 0.7))
        alpha = SAND_ALPHA * edge * edge * (3 - 2 * edge)
        d = r * SAND_RADIUS / max(clam_reach, 0.01)
        shade = 0.75 + 0.25 * max(0.0, min(1.0, (d - 0.55) / 0.7))
        ripple = 0.03 * math.sin(u * 23.0 + v * 7.0) + 0.02 * math.sin(v * 31.0 - u * 11.0)
        g = grain() * 0.06 + ripple
        k = (py * SAND_SIZE + px) * 4
        pixels[k:k + 4] = [max(0.0, min(1.0, (0.77 + g) * shade)), max(0.0, min(1.0, (0.745 + g) * shade)),
                           max(0.0, min(1.0, (0.635 + g) * shade)), alpha]
generated = bpy.data.images.new('clam-sand', SAND_SIZE, SAND_SIZE, alpha=True)
generated.pixels = pixels
os.makedirs(os.path.dirname(out_path), exist_ok=True)
sand_path = os.path.join(os.path.dirname(out_path), 'clam-sand.png')
generated.filepath_raw = sand_path
generated.file_format = 'PNG'
generated.save()
sand_img = bpy.data.images.load(sand_path)
mat = bpy.data.materials.new('sand')
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes['Principled BSDF']
bsdf.inputs['Roughness'].default_value = 1.0
bsdf.inputs['Metallic'].default_value = 0
tex = nt.nodes.new('ShaderNodeTexImage')
tex.image = sand_img
tone = nt.nodes.new('ShaderNodeMix')
tone.data_type = 'RGBA'
tone.blend_type = 'MULTIPLY'
tone.inputs['Factor'].default_value = 1.0
tone.inputs[7].default_value = (*SAND_TONE, 1.0)
nt.links.new(tex.outputs['Color'], tone.inputs[6])
nt.links.new(tone.outputs[2], bsdf.inputs['Base Color'])
nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
if hasattr(mat, 'surface_render_method'):
    mat.surface_render_method = 'BLENDED'
else:
    mat.blend_method = 'BLEND'
bpy.ops.mesh.primitive_circle_add(vertices=64, radius=SAND_RADIUS, fill_type='TRIFAN', calc_uvs=True, location=(0, 0, 0))
sand = bpy.context.active_object
sand.name = 'sand'
sand.data.materials.append(mat)

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
                          export_image_format='AUTO', export_texcoords=True,
                          export_normals=True, export_yup=True, export_animations=False, export_morph=False)
os.remove(sand_path)
print('GLB', out_path, os.path.getsize(out_path))
