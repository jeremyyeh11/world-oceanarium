# Builds the leather coral's Atlas specimen: the kit's toadstools on a low limestone rock, headless,
# from the built kit (scripts/build-leather-coral-kit.py) and the reef's rock kit:
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#     --python scripts/build-leather-coral-atlas.py -- public/models/landscape \
#     public/models/fish/sarcophyton-glaucum/sarcophyton-glaucum.glb [preview-dir]
#
# After scripts/build-cauliflower-coral-atlas.py: one kit rock fitted to a low box, cube-projected
# at the tank's tile size and darkened toward the tank's rock tone, with all four toadstools at
# their true size (49 to 66 cm tall) on its top, a loose patch as in the tank. Each foot is found by
# a ray down onto the rock and sunk 4% of the colony's height, as the tank sinks them
# (src/components/leatherCoralPlacement.js SINK). The toadstools keep the kit's photo materials and
# stay one node each with its holdfast at the node's origin, so the Atlas sways them from their feet
# (EncyclopediaPage.jsx prepareAtlasSway; the rock, a node named `rock`, stays still). Everything in
# metres, the rock's foot centred on the origin. Prints the specimen's bounds: its largest extent is
# the Atlas source length (EncyclopediaPage.jsx).

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

def rock_material(color_path, normal_path, tone):
    mat = bpy.data.materials.new('limestone')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 1.0
    # A multiply exports as the glTF base colour factor.
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    mix.inputs[7].default_value = (*tone, 1.0)
    nt.links.new(image_node(nt, color_path).outputs['Color'], mix.inputs[6])
    nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
    normal_map = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(image_node(nt, normal_path, True).outputs['Color'], normal_map.inputs['Color'])
    nt.links.new(normal_map.outputs['Normal'], bsdf.inputs['Normal'])
    return mat

# --- Rock: as the cauliflower coral's, a little wider for four toadstools ---------------------
src = imported(os.path.join(kit_dir, 'limestone-boulders.glb'))
rock = src['rock5_hi'].copy()
rock.data = src['rock5_hi'].data.copy()
for o in src.values():
    bpy.data.objects.remove(o, do_unlink=True)
scene.collection.objects.link(rock)
rock.name = rock.data.name = 'rock'
# A low rock about 1.5 m across, 1 m deep and 0.3 m tall: a piece of the reef's lower flank.
size = (1.5, 1.0, 0.3)
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
bpy.ops.uv.cube_project(cube_size=0.75, scale_to_bounds=False)
bpy.ops.object.mode_set(mode='OBJECT')
rock.data.materials.clear()
rock.data.materials.append(rock_material(os.path.join(kit_dir, 'limestone-color.jpg'),
                                         os.path.join(kit_dir, 'limestone-normal.jpg'), (0.62, 0.62, 0.62)))

# --- The toadstools on the rock ---------------------------------------------------------------
kit = imported(os.path.join(kit_dir, 'leather-corals.glb'))
colonies = {o.name: o for o in kit.values() if o.type == 'MESH' and o.name.startswith('leather')}
for o in kit.values():
    if o.name not in colonies:
        bpy.data.objects.remove(o, do_unlink=True)

tree = BVHTree.FromObject(rock, bpy.context.evaluated_depsgraph_get())
# (kit colony, x, depth, turn about Z): the classic peach toadstool (3) front and centre, the
# leaning grey one (0) behind on the left, the two-headed one (1) behind on the right, the small
# peach one (2) at the front right. True size, turned only about the vertical.
PLACES = [(3, -0.05, -0.18, 0.3), (0, -0.42, 0.18, -0.5), (1, 0.38, 0.2, 2.4), (2, 0.5, -0.25, 1.2)]
SINK = 0.04
shown = []
bases = []
for model, x, y, turn in PLACES:
    colony = colonies[f'leather{model}']
    shown.append(colony)
    # Down onto the rock, stepping in toward its middle until the ray meets it.
    hit = None
    while hit is None:
        hit, _, _, _ = tree.ray_cast(Vector((x, y, 2.0)), Vector((0, 0, -1)))
        x *= 0.9
        y *= 0.9
    base = hit - Vector((0, 0, colony.dimensions.z * SINK))
    colony.location = base
    colony.rotation_euler = (0, 0, turn)
    bases.append(tuple(round(v, 3) for v in base))
for o in list(colonies.values()):
    if o not in shown:
        bpy.data.objects.remove(o, do_unlink=True)
update()

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
    cam.location = (0.35, -2.0, 1.0)
    target = Vector((0, 0, hi.z / 2))
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.filepath = os.path.join(preview_dir, 'leather-coral-atlas.png')
    bpy.ops.render.render(write_still=True)
    print('PREVIEW', scene.render.filepath)

os.makedirs(os.path.dirname(out_path), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for o in [rock] + shown:
    o.select_set(True)
bpy.context.view_layer.objects.active = shown[0]
bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=True, export_materials='EXPORT',
                          export_image_format='JPEG', export_image_quality=85, export_texcoords=True,
                          export_normals=True, export_yup=True, export_animations=False)
print('GLB', out_path, os.path.getsize(out_path))
