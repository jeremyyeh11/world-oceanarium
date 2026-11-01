# Builds the brain coral's Atlas specimen: the kit's colonies on a low limestone rock, headless,
# from the built kit (scripts/build-brain-coral-kit.py) and the reef's rock kit:
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#     --python scripts/build-brain-coral-atlas.py -- public/models/landscape \
#     public/models/fish/platygyra-daedalea/platygyra-daedalea.glb [preview-dir]
#
# Like the sea fan's specimen (scripts/build-sea-fan-atlas.py): one kit rock fitted to a low box,
# cube-projected at the tank's tile size and darkened toward the tank's rock tone. The biggest
# colony (brain0) sits on the rock's top, a little behind its middle; the next (brain1), if the kit
# has one, on its front-right shoulder, turned. Each base is found by a ray down onto the rock and
# sunk 2 cm, as the tank sinks them (src/components/brainCoralPlacement.js). The colonies carry the
# kit's baked colour and normal maps. Everything in metres, the rock's foot centred on the origin.
# Prints the specimen's bounds: its largest extent is the Atlas source length
# (EncyclopediaPage.jsx), and its width the species' maxBodyLengthMeters.

import bpy, sys, os
from mathutils import Vector
from mathutils.bvhtree import BVHTree

args = sys.argv[sys.argv.index('--') + 1:]
kit_dir, out_path = os.path.abspath(args[0]), os.path.abspath(args[1])
preview_dir = args[2] if len(args) > 2 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def imported(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return {o.name: o for o in bpy.data.objects if o not in before}

def update():
    bpy.context.view_layer.update()

def world_bounds(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))

def image_node(nt, path, non_color=False):
    node = nt.nodes.new('ShaderNodeTexImage')
    node.image = bpy.data.images.load(path)
    if non_color:
        node.image.colorspace_settings.name = 'Non-Color'
    return node

def textured(name, color_path, normal_path, roughness, tone=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = roughness
    color = image_node(nt, color_path).outputs['Color']
    if tone:
        # A multiply exports as the glTF base colour factor.
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        mix.inputs[7].default_value = (*tone, 1.0)
        nt.links.new(color, mix.inputs[6])
        color = mix.outputs[2]
    nt.links.new(color, bsdf.inputs['Base Color'])
    normal_map = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(image_node(nt, normal_path, True).outputs['Color'], normal_map.inputs['Color'])
    nt.links.new(normal_map.outputs['Normal'], bsdf.inputs['Normal'])
    return mat

# --- Rock: as the sea fan's, darker as the tank paints it ------------------------------------
src = imported(os.path.join(kit_dir, 'limestone-boulders.glb'))
rock = src['rock5_hi'].copy()
rock.data = src['rock5_hi'].data.copy()
for o in src.values():
    bpy.data.objects.remove(o, do_unlink=True)
scene.collection.objects.link(rock)
rock.name = rock.data.name = 'rock'
# A low rock about 2.6 m across, 1.6 m deep and 0.6 m tall: the colonies' seat, not a bommie,
# deep enough to bury their undersides.
size = (2.6, 1.6, 0.6)
dims = rock.dimensions
rock.rotation_euler = (0, 0, 0.15)
rock.scale = (size[0] / dims.x, size[1] / dims.y, size[2] / dims.z)
update()
lo, hi = world_bounds([rock])
rock.location = (-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)
update()
bpy.ops.object.select_all(action='DESELECT')
rock.select_set(True)
bpy.context.view_layer.objects.active = rock
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
while rock.data.uv_layers:
    rock.data.uv_layers.remove(rock.data.uv_layers[0])
rock.data.uv_layers.new(name='UVMap')
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.cube_project(cube_size=1.5, scale_to_bounds=False)
bpy.ops.object.mode_set(mode='OBJECT')
rock.data.materials.clear()
rock.data.materials.append(textured('limestone', os.path.join(kit_dir, 'limestone-color.jpg'),
                                    os.path.join(kit_dir, 'limestone-normal.jpg'), 1.0, (0.62, 0.62, 0.62)))

# --- The colonies on the rock -----------------------------------------------------------------
kit = imported(os.path.join(kit_dir, 'brain-corals.glb'))
models = sorted(name[:-3] for name in kit if name.endswith('_hi'))
colonies = []
for name in models:
    o = kit[f'{name}_hi']
    o.name = name
    o.data.materials.clear()
    o.data.materials.append(textured(name, os.path.join(kit_dir, f'{name}-color.jpg'),
                                     os.path.join(kit_dir, f'{name}-normal.jpg'), 0.9))
    colonies.append(o)
for o in kit.values():
    if o not in colonies:
        bpy.data.objects.remove(o, do_unlink=True)

tree = BVHTree.FromObject(rock, bpy.context.evaluated_depsgraph_get())
# (kit colony, x, depth, scale, turn about Z): three colours, as on a reef where neighbouring
# colonies differ. The orange (brain1, his most detailed) big on top, a little behind the middle;
# the blue and brown (brain0) smaller on the front-left shoulder; the pale one (brain3) smallest on
# the front right. Turned only about the vertical: a colony has an up (Jeremy, 2026-10-30).
PLACES = [(1, 0.05, 0.15, 0.8, 0.0), (0, -0.62, -0.18, 0.5, 0.9), (3, 0.66, -0.2, 0.42, -0.6)]
by_name = {o.name: o for o in colonies}
shown = []
bases = []
for model, x, y, scale, turn in PLACES:
    colony = by_name[f'brain{model}']
    shown.append(colony)
    # Down onto the rock, stepping in toward its middle until the ray meets it.
    hit = None
    while hit is None:
        hit, _, _, _ = tree.ray_cast(Vector((x, y, 2.0)), Vector((0, 0, -1)))
        x *= 0.9
    base = hit - Vector((0, 0, 0.02))
    colony.location = base
    colony.rotation_euler = (0, 0, turn)
    colony.scale = (scale, scale, scale)
    bases.append(tuple(round(v, 3) for v in base))
for o in colonies:
    if o not in shown:
        bpy.data.objects.remove(o, do_unlink=True)
update()
# The buried undersides must stay inside the rock: count kit vertices below the rock's surface
# that come out under it or beside it.
depsgraph = bpy.context.evaluated_depsgraph_get()
for o in shown:
    showing = 0
    below = [o.matrix_world @ v.co for v in o.data.vertices if v.co.z < 0]
    for p in below:
        hit = tree.ray_cast(p, Vector((0, 0, 1)))
        if hit[0] is None or hit[1].z <= 0:
            showing += 1
    print('BURIED', o.name, 'underside vertices', len(below), 'outside the rock', showing)

lo, hi = world_bounds([rock] + shown)
print('BOUNDS', tuple(round(v, 3) for v in lo), tuple(round(v, 3) for v in hi),
      'largest', round(max(hi - lo), 3), 'bases', bases)

if preview_dir:
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = scene.render.resolution_y = 900
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('w')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.06, 0.14, 0.32, 1)
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3
    sun.rotation_euler = (0.7, 0.2, -0.4)
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.lens = 40
    cam.location = (0.6, -2.6, 1.4)
    target = Vector((0, 0, hi.z / 2))
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.filepath = os.path.join(preview_dir, 'brain-coral-atlas.png')
    bpy.ops.render.render(write_still=True)
    print('PREVIEW', scene.render.filepath)

os.makedirs(os.path.dirname(out_path), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for o in [rock] + shown:
    o.select_set(True)
bpy.context.view_layer.objects.active = shown[0]
bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=True, export_materials='EXPORT',
                          export_image_format='JPEG', export_texcoords=True, export_normals=True,
                          export_yup=True, export_animations=False)
print('GLB', out_path, os.path.getsize(out_path))
