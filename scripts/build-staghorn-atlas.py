# Builds the staghorn coral's Atlas specimen: a thicket on the sand round a low rock, as the
# tank grows them (src/components/staghornPlacement.js, Jeremy's pick 2026-10-20: thickets at the
# foot of rocks). Headless, without touching an open Blender scene:
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#     --python scripts/build-staghorn-atlas.py -- public/models/landscape \
#     public/models/fish/acropora-muricata/acropora-muricata.glb [preview-dir]
#
# Reads the staghorn kit (staghorn-corals.glb and its baked maps, scripts/build-staghorn-kit.py)
# and the limestone rock kit from the first folder. The rock is one kit rock fitted to a low box
# and cube-projected at the tank's texture size, as in scripts/build-coral-atlas.py. Colonies
# stand on the sand in a band along the rock's front, the big ones in its middle and small ones
# toward its ends, each sunk a little into the sand and kept only where its branches stay out
# of the rock and clear of the colonies already placed (they may interlock, as in a thicket).
# Unlike the tank's thickets, which are mostly one clone and one colour, the specimen mixes the
# three colours the species comes in (blue, brown and cream; Wikipedia). Under it lies the same
# faint sand patch as the table coral's. Everything is in metres, centred on the rock and
# colonies. With a preview folder it also renders the specimen from the Atlas's angle.

import bpy, sys, os, math, random
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
staghorn_kit = imported(os.path.join(kit_dir, 'staghorn-corals.glb'))
for o in list(rock_kit.values()) + list(staghorn_kit.values()):
    o.hide_render = True
    o.hide_set(True)

def update():
    bpy.context.view_layer.update()

def world_bounds(obj):
    pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))

def toned(nt, color_socket, tone):
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    mix.inputs[7].default_value = (*tone, 1.0)
    nt.links.new(color_socket, mix.inputs[6])
    return mix.outputs[2]

# --- Rock ---------------------------------------------------------------------------------
rock_mat = bpy.data.materials.new('limestone')
rock_mat.use_nodes = True
nt = rock_mat.node_tree
bsdf = nt.nodes['Principled BSDF']
bsdf.inputs['Roughness'].default_value = 1.0
color = nt.nodes.new('ShaderNodeTexImage')
color.image = bpy.data.images.load(os.path.join(kit_dir, 'limestone-color.jpg'))
# The tank paints its rock darker (landscapes.js rockShade tone 0.66).
nt.links.new(toned(nt, color.outputs['Color'], (0.62, 0.62, 0.62)), bsdf.inputs['Base Color'])
normal = nt.nodes.new('ShaderNodeTexImage')
normal.image = bpy.data.images.load(os.path.join(kit_dir, 'limestone-normal.jpg'))
normal.image.colorspace_settings.name = 'Non-Color'
normal_map = nt.nodes.new('ShaderNodeNormalMap')
nt.links.new(normal.outputs['Color'], normal_map.inputs['Color'])
nt.links.new(normal_map.outputs['Normal'], bsdf.inputs['Normal'])

def fitted_rock(name, size, centre_xy, base_z, yaw):
    src = rock_kit[name]
    obj = src.copy()
    obj.data = src.data.copy()
    obj.name = f'rock_{name}'
    scene.collection.objects.link(obj)
    obj.hide_render = False
    obj.hide_set(False)
    dims = src.dimensions
    obj.rotation_euler = (0, 0, yaw)
    obj.scale = (size[0] / dims.x, size[1] / dims.y, size[2] / dims.z)
    obj.location = (0, 0, 0)
    update()
    lo, hi = world_bounds(obj)
    obj.location = (centre_xy[0] - (lo.x + hi.x) / 2, centre_xy[1] - (lo.y + hi.y) / 2, base_z - lo.z)
    update()
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    while obj.data.uv_layers:
        obj.data.uv_layers.remove(obj.data.uv_layers[0])
    obj.data.uv_layers.new(name='UVMap')
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.cube_project(cube_size=1.5, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.data.materials.clear()
    obj.data.materials.append(rock_mat)
    return obj

# A low boulder, sunk a little into the sand (z 0), wider than deep; +y is behind it, -y the
# front the Atlas faces.
FOOT_Z = 0.0
rock = fitted_rock('rock3_hi', (1.6, 1.0, 0.75), (0, 0.35), FOOT_Z - 0.12, 0.3)
depsgraph = bpy.context.evaluated_depsgraph_get()
tree = BVHTree.FromObject(rock, depsgraph)

def inside(point):
    # Leaving the rock through its top: the first face above faces up.
    hit = tree.ray_cast(point, Vector((0, 0, 1)))
    return hit[0] is not None and hit[1].z > 0

# --- Colonies -----------------------------------------------------------------------------
def colony_material(i):
    mat = bpy.data.materials.new(f'staghorn{i}')
    mat.use_nodes = True
    nt = mat.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = 0.95
    c = nt.nodes.new('ShaderNodeTexImage')
    c.image = bpy.data.images.load(os.path.join(kit_dir, f'staghorn{i}-color.jpg'))
    n = nt.nodes.new('ShaderNodeTexImage')
    n.image = bpy.data.images.load(os.path.join(kit_dir, f'staghorn{i}-normal.jpg'))
    n.image.colorspace_settings.name = 'Non-Color'
    m = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(c.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(n.outputs['Color'], m.inputs['Color'])
    nt.links.new(m.outputs['Normal'], b.inputs['Normal'])
    return mat

shapes = {}
for i in range(6):
    src = staghorn_kit[f'staghorn{i}_hi']
    src.data.materials.clear()
    src.data.materials.append(colony_material(i))
    verts = [v.co for v in src.data.vertices]
    height = max(v.z for v in verts)
    radius = max(math.hypot(v.x, v.y) for v in verts)
    above = [v for v in verts if v.z > height * 0.2]
    shapes[i] = {'height': height, 'radius': radius, 'samples': above[::max(1, len(above) // 40)]}

placed = []
bases = []
rng = random.Random(7301)
lo_r, hi_r = world_bounds(rock)
front_y = lo_r.y

def colony(model, scale, x, y):
    """A colony of kit model `model` at `scale` with its base at (x, y), turned at random, kept
    only if its branches stay out of the rock and the sand and clear of colonies placed already."""
    shape = shapes[model]
    reach = shape['radius'] * scale
    if any(math.hypot(x - bx, y - by) < (reach + br) * 0.33 for bx, by, br in bases):
        return False
    for _ in range(12):
        yaw = rng.uniform(0, math.tau)
        tilt = Matrix.Rotation(rng.uniform(-0.12, 0.12), 4, 'X') @ Matrix.Rotation(rng.uniform(-0.12, 0.12), 4, 'Y')
        sink = shape['height'] * scale * 0.08
        matrix = Matrix.Translation((x, y, FOOT_Z - sink)) @ tilt @ Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Scale(scale, 4)
        pts = [matrix @ v for v in shape['samples']]
        if sum(1 for p in pts if inside(p)) > 2 or any(p.z < FOOT_Z - 0.02 for p in pts):
            continue
        obj = staghorn_kit[f'staghorn{model}_hi'].copy()
        obj.name = f'colony_{len(placed)}'
        scene.collection.objects.link(obj)
        obj.hide_render = False
        obj.hide_set(False)
        obj.matrix_world = matrix
        placed.append(obj)
        bases.append((x, y, reach))
        return True
    return False

# The band: along the rock's front and round its ends, the big colonies first in its middle.
# Model pairs [big, small] per colour: brown 0/1, cream 2/3, blue 4/5.
# (model, scale, place along the rock in m, row: 0 hugging the rock, 1 in front of it)
plan = [(0, 1.15, 0.0, 0), (4, 1.3, -0.6, 0), (2, 1.0, 0.65, 0), (0, 0.9, -0.3, 1), (4, 1.1, 0.35, 1),
        (1, 1.1, 0.25, 0), (5, 1.3, -0.25, 0), (3, 1.4, -0.95, 0), (1, 1.0, 1.0, 0), (5, 1.2, -0.75, 1),
        (3, 1.2, 0.8, 1), (1, 0.9, 0.0, 1), (5, 1.0, 1.05, 1), (3, 1.0, -1.05, 1), (1, 0.8, -0.5, 1),
        (5, 0.9, 0.55, 1)]
for model, scale, along, row in plan:
    for attempt in range(40):
        x = along + rng.uniform(-0.15, 0.15)
        # Hug the rock's front; the band's ends wrap back round its sides.
        y = front_y - (0.05 + row * 0.4) - rng.uniform(0, 0.3) + 0.5 * max(0.0, abs(x) - 0.6)
        if colony(model, scale, x, y):
            break
    else:
        print('COLONY skipped', model, scale, along)
print('COLONIES', len(placed))

# --- Sand (as the table coral's specimen) ---------------------------------------------------
SAND_SIZE = 256
SAND_RADIUS = 2.6
SAND_TONE = (0.25, 0.25, 0.25)
SAND_ALPHA = 0.6
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
        ripple = 0.03 * math.sin(u * 23.0 + v * 7.0) + 0.02 * math.sin(v * 31.0 - u * 11.0)
        g = grain() * 0.06 + ripple
        k = (py * SAND_SIZE + px) * 4
        pixels[k:k + 4] = [max(0.0, min(1.0, 0.77 + g)), max(0.0, min(1.0, 0.745 + g)), max(0.0, min(1.0, 0.635 + g)), alpha]
generated = bpy.data.images.new('staghorn-sand', SAND_SIZE, SAND_SIZE, alpha=True)
generated.pixels = pixels
os.makedirs(os.path.dirname(out_path), exist_ok=True)
sand_path = os.path.join(os.path.dirname(out_path), 'staghorn-sand.png')
generated.filepath_raw = sand_path
generated.file_format = 'PNG'
generated.save()
sand_img = bpy.data.images.load(sand_path)
sand_mat = bpy.data.materials.new('sand')
sand_mat.use_nodes = True
nt = sand_mat.node_tree
b = nt.nodes['Principled BSDF']
b.inputs['Roughness'].default_value = 1.0
tex = nt.nodes.new('ShaderNodeTexImage')
tex.image = sand_img
nt.links.new(toned(nt, tex.outputs['Color'], SAND_TONE), b.inputs['Base Color'])
nt.links.new(tex.outputs['Alpha'], b.inputs['Alpha'])
if hasattr(sand_mat, 'surface_render_method'):
    sand_mat.surface_render_method = 'BLENDED'
else:
    sand_mat.blend_method = 'BLEND'
bpy.ops.mesh.primitive_circle_add(vertices=64, radius=SAND_RADIUS, fill_type='TRIFAN', calc_uvs=True,
                                  location=(0, 0, FOOT_Z + 0.005))
sand = bpy.context.active_object
sand.name = 'sand'
sand.data.materials.append(sand_mat)

# Centre the rock and colonies on the origin.
objs = [rock] + placed
update()
lo = Vector((min(world_bounds(o)[0].x for o in objs), min(world_bounds(o)[0].y for o in objs), min(world_bounds(o)[0].z for o in objs)))
hi = Vector((max(world_bounds(o)[1].x for o in objs), max(world_bounds(o)[1].y for o in objs), max(world_bounds(o)[1].z for o in objs)))
shift = -(lo + hi) / 2
rock.data.transform(Matrix.Translation(shift))
for o in placed:
    o.matrix_world = Matrix.Translation(shift) @ o.matrix_world
sand.matrix_world = Matrix.Translation((shift.x, shift.y, shift.z)) @ sand.matrix_world
update()
print('BOUNDS', tuple(round(v, 3) for v in (hi - lo)))

bpy.ops.object.select_all(action='DESELECT')
for o in objs + [sand]:
    o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=True, export_image_format='AUTO',
                          export_texcoords=True, export_normals=True, export_yup=True, export_animations=False)
os.remove(sand_path)
print('GLB', out_path, os.path.getsize(out_path))

if preview_dir:
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 900
    scene.render.resolution_y = 600
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('w')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.08, 0.25, 0.42, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 1.2
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    scene.collection.objects.link(sun)
    sun.data.energy = 3.0
    sun.rotation_euler = (math.radians(35), math.radians(-25), math.radians(30))
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.lens = 40
    # The Atlas looks 30 degrees down onto the front (-y).
    for name, direction in [('atlas', Vector((0, 1, -math.tan(math.radians(30))))), ('front', Vector((0, 1, -0.05)))]:
        d = direction.normalized()
        cam.location = -d * 7
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(os.path.abspath(preview_dir), f'staghorn_atlas_{name}.png')
        bpy.ops.render.render(write_still=True)
    print('PREVIEW', preview_dir)
