# Builds the giant sea fan's Atlas specimen: the kit's tallest fan (fan0) growing from a limestone
# rock, headless, from the built kit (scripts/build-sea-fan-kit.py) and the reef's rock kit:
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#     --python scripts/build-sea-fan-atlas.py -- public/models/landscape \
#     public/models/fish/annella-mollis/annella-mollis.glb [preview-dir]
#
# Jeremy (2026-10-26): "add a rock base to the fan in the atlas viewport"; a fan grows from a
# holdfast cemented to rock. The rock is one kit rock fitted to a low box, shaded like the
# staghorn specimen's (scripts/build-staghorn-atlas.py); the three fans stand on it, holdfasts
# sunk 2 cm in, lattices facing the front (-Y). Each fan keeps its own node, origin at its
# holdfast, so the Atlas sways it about that point (EncyclopediaPage.jsx prepareAtlasSway) and not
# the rock. Everything in metres, the rock's foot centred on the origin. Prints the specimen's
# bounds: its largest extent is the Atlas source length (EncyclopediaPage.jsx).

import bpy, sys, os
from mathutils import Matrix, Vector
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

rock_kit = imported(os.path.join(kit_dir, 'limestone-boulders.glb'))
fan_kit = imported(os.path.join(kit_dir, 'sea-fans.glb'))
fans = [fan_kit['fan0'], fan_kit['fan1'], fan_kit['fan2']]
for o in list(rock_kit.values()) + [o for o in fan_kit.values() if o not in fans]:
    bpy.data.objects.remove(o, do_unlink=True)

def update():
    bpy.context.view_layer.update()

def world_bounds(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))

# --- Rock: as the staghorn specimen's, darker as the tank paints it ---------------------------
rock_mat = bpy.data.materials.new('limestone')
rock_mat.use_nodes = True
nt = rock_mat.node_tree
bsdf = nt.nodes['Principled BSDF']
bsdf.inputs['Roughness'].default_value = 1.0
color = nt.nodes.new('ShaderNodeTexImage')
color.image = bpy.data.images.load(os.path.join(kit_dir, 'limestone-color.jpg'))
mix = nt.nodes.new('ShaderNodeMix')
mix.data_type = 'RGBA'
mix.blend_type = 'MULTIPLY'
mix.inputs['Factor'].default_value = 1.0
mix.inputs[7].default_value = (0.62, 0.62, 0.62, 1.0)
nt.links.new(color.outputs['Color'], mix.inputs[6])
nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
normal = nt.nodes.new('ShaderNodeTexImage')
normal.image = bpy.data.images.load(os.path.join(kit_dir, 'limestone-normal.jpg'))
normal.image.colorspace_settings.name = 'Non-Color'
normal_map = nt.nodes.new('ShaderNodeNormalMap')
nt.links.new(normal.outputs['Color'], normal_map.inputs['Color'])
nt.links.new(normal_map.outputs['Normal'], bsdf.inputs['Normal'])

src = imported(os.path.join(kit_dir, 'limestone-boulders.glb'))
rock_src = src['rock5_hi']
rock = rock_src.copy()
rock.data = rock_src.data.copy()
for o in src.values():
    bpy.data.objects.remove(o, do_unlink=True)
scene.collection.objects.link(rock)
rock.name = rock.data.name = 'rock'
# A low rock about 1.1 m across, 0.55 m deep and 0.38 m tall: the fans' base, not a bommie.
size = (1.1, 0.55, 0.38)
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
rock.data.materials.append(rock_mat)

# --- The fans on the rock: the orange one (fan0) on its top, a little behind its middle; the
# yellow (fan1) and pink (fan2), smaller, on its left and right shoulders, leaning outward and
# turned a little toward the viewer (Jeremy, 2026-10-26: "add the other two colours in left and
# right"). Lattices face -Y; each stands a little apart in depth so no two lattices meet: the
# yellow in front of the orange (behind it, the orange hid it), the pink level with it.
# The kit's fans face glTF +Z, Blender -Y; the import keeps that.
tree = BVHTree.FromObject(rock, bpy.context.evaluated_depsgraph_get())
# (fan, x, depth, scale, lean about Y (outward), turn about Z)
PLACES = [(fans[0], 0.0, 0.05, 1.0, 0.0, 0.0),
          (fans[1], -0.5, -0.12, 0.88, -0.55, 0.3),
          (fans[2], 0.47, 0.0, 0.78, 0.75, -0.25)]
holdfasts = []
for fan, x, y, scale, lean, turn in PLACES:
    # Down onto the rock, stepping in toward its middle until the ray meets it.
    hit = None
    while hit is None:
        hit, _, _, _ = tree.ray_cast(Vector((x, y, 2.0)), Vector((0, 0, -1)))
        x *= 0.9
    holdfast = hit - Vector((0, 0, 0.02))
    fan.location = holdfast
    fan.rotation_euler = (0, lean, turn)
    fan.scale = (scale, scale, scale)
    holdfasts.append(tuple(round(v, 3) for v in holdfast))
update()

lo, hi = world_bounds([rock] + fans)
print('BOUNDS', tuple(round(v, 3) for v in lo), tuple(round(v, 3) for v in hi),
      'largest', round(max(hi - lo), 3), 'holdfasts', holdfasts)

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
    cam.location = (0.5, -2.6, 0.9)
    target = Vector((0, 0, (hi.z) / 2))
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.filepath = os.path.join(preview_dir, 'sea-fan-atlas.png')
    bpy.ops.render.render(write_still=True)
    print('PREVIEW', scene.render.filepath)

os.makedirs(os.path.dirname(out_path), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for o in [rock] + fans:
    o.select_set(True)
bpy.context.view_layer.objects.active = fans[0]
bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=True, export_materials='EXPORT',
                          export_image_format='WEBP', export_texcoords=True, export_normals=True,
                          export_yup=True, export_animations=False)
print('GLB', out_path, os.path.getsize(out_path))
