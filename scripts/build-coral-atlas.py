# Builds the table coral's Atlas specimen: a small bommie crowned with tables, as in Jeremy's
# references (2026-10-19: "in the atlas, show a cluster instead of one single stalk", then his
# photo of a bommie crowned with tables, one huge one spreading out low from its foot: "the
# atlas viewport should display something like this").
# Headless, without touching an open Blender scene:
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#     --python scripts/build-coral-atlas.py -- public/models/landscape \
#     public/models/fish/acropora-hyacinthus/acropora-hyacinthus.glb [preview-dir]
#
# Reads the coral kit (table-corals.glb and its baked maps, scripts/build-coral-kit.py) and the
# limestone rock kit from the first folder. The rock is two kit rocks fitted to boxes like a
# tank stack: a wide bottom tier and a smaller top tier dropped onto it, cube-projected at the
# tank's texture size (1.5 m a tile) and darkened toward the tank's rock tone. Each table's
# foot is found by a ray down onto the rock (a ray in for one growing out of a wall); its stalk
# sinks a little into the rock, and its plate is checked against the rock, as in the tank
# (src/components/coralPlacement.js). No sand: a patch of it read as a white glow under the
# rock (Jeremy: "remove the white radial highlight"), so every table grows from the rock. Everything
# is in metres, centred on the origin. With a preview folder it also renders the cluster from the
# Atlas's angle (30 degrees down, turned like its pose) and from the front.

import bpy, sys, os, math
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

args = sys.argv[sys.argv.index('--') + 1:]
kit_dir, out_path = args[0], args[1]
preview_dir = args[2] if len(args) > 2 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def imported(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return {o.name: o for o in bpy.data.objects if o not in before}

rock_kit = imported(os.path.join(kit_dir, 'limestone-boulders.glb'))
coral_kit = imported(os.path.join(kit_dir, 'table-corals.glb'))
for o in list(rock_kit.values()) + list(coral_kit.values()):
    o.hide_render = True
    o.hide_set(True)

def update():
    bpy.context.view_layer.update()

def world_bounds(obj):
    pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))

# --- Rock ---------------------------------------------------------------------------------
rock_mat = bpy.data.materials.new('limestone')
rock_mat.use_nodes = True
nodes, links = rock_mat.node_tree.nodes, rock_mat.node_tree.links
bsdf = nodes['Principled BSDF']
bsdf.inputs['Roughness'].default_value = 1.0
color = nodes.new('ShaderNodeTexImage')
color.image = bpy.data.images.load(os.path.join(kit_dir, 'limestone-color.jpg'))
# The tank paints its rock darker (landscapes.js rockShade tone 0.66); a multiply exports as
# the glTF base colour factor.
tone = nodes.new('ShaderNodeMix')
tone.data_type = 'RGBA'
tone.blend_type = 'MULTIPLY'
tone.inputs['Factor'].default_value = 1.0
tone.inputs[7].default_value = (0.62, 0.62, 0.62, 1.0)
links.new(color.outputs['Color'], tone.inputs[6])
links.new(tone.outputs[2], bsdf.inputs['Base Color'])
normal = nodes.new('ShaderNodeTexImage')
normal.image = bpy.data.images.load(os.path.join(kit_dir, 'limestone-normal.jpg'))
normal.image.colorspace_settings.name = 'Non-Color'
normal_map = nodes.new('ShaderNodeNormalMap')
links.new(normal.outputs['Color'], normal_map.inputs['Color'])
links.new(normal_map.outputs['Normal'], bsdf.inputs['Normal'])

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
    # Cube projection at the tank's tile size, after the stretch (Landscape.jsx projectUVs).
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

def rock_tree(objs):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    return [BVHTree.FromObject(o, depsgraph) for o in objs]

def nearest(trees, origin, direction):
    best = None
    for tree in trees:
        hit = tree.ray_cast(origin, direction)
        if hit[0] is not None and (best is None or hit[3] < best[3]):
            best = hit
    return best

def inside(trees, point):
    # Leaving a rock through its top: the first face above, on any rock, faces up.
    for tree in trees:
        hit = tree.ray_cast(point, Vector((0, 0, 1)))
        if hit[0] is not None and hit[1].z > 0:
            return True
    return False

# The bommie: one chunky, stepped block (rock0, the kit's blockiest rock, like the block in
# Jeremy's photo) and a low lump at each front corner of its foot for the big low tables.
bottom = fitted_rock('rock0_hi', (2.8, 2.3, 1.35), (0, 0.1), 0, 0.6)
lump = fitted_rock('rock3_hi', (1.3, 1.1, 0.6), (-1.35, -0.6), 0, 1.1)
lump_right = fitted_rock('rock3_hi', (1.4, 1.2, 0.5), (1.45, -0.45), 0, -0.7)
rocks = [bottom, lump, lump_right]
trees = rock_tree(rocks)

# --- Corals -------------------------------------------------------------------------------
# The Atlas lights its stage brighter and bluer than the tank, and the plates' pale tops face
# straight up into its key lights, so they read a washed-out grey-blue there; the photo's tables
# are tan and salmon. The Atlas specimen takes them a little down and warmer. A multiply exports
# as the glTF base colour factor. The tank's corals are unchanged.
ATLAS_CORAL_TONE = (0.95, 0.8, 0.7)

def toned(nt, color_socket, tone):
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    mix.inputs[7].default_value = (*tone, 1.0)
    nt.links.new(color_socket, mix.inputs[6])
    return mix.outputs[2]

def coral_material(i):
    mat = bpy.data.materials.new(f'coral{i}')
    mat.use_nodes = True
    nt = mat.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = 0.95
    c = nt.nodes.new('ShaderNodeTexImage')
    c.image = bpy.data.images.load(os.path.join(kit_dir, f'coral{i}-color.jpg'))
    n = nt.nodes.new('ShaderNodeTexImage')
    n.image = bpy.data.images.load(os.path.join(kit_dir, f'coral{i}-normal.jpg'))
    n.image.colorspace_settings.name = 'Non-Color'
    m = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(toned(nt, c.outputs['Color'], ATLAS_CORAL_TONE), b.inputs['Base Color'])
    nt.links.new(n.outputs['Color'], m.inputs['Color'])
    nt.links.new(m.outputs['Normal'], b.inputs['Normal'])
    return mat

shapes = {}
for i in range(3):
    src = coral_kit[f'coral{i}_hi']
    src.data.materials.clear()
    src.data.materials.append(coral_material(i))
    verts = [v.co for v in src.data.vertices]
    height = max(v.z for v in verts)
    plate = [v for v in verts if v.z >= height * 0.6]
    cx = sum(v.x for v in plate) / len(plate)
    cy = sum(v.y for v in plate) / len(plate)
    radius = max(math.hypot(v.x - cx, v.y - cy) for v in plate)
    samples = plate[::max(1, len(plate) // 40)]
    shapes[i] = {'height': height, 'centre': (cx, cy), 'radius': radius, 'samples': samples}

lo_c, hi_c = world_bounds(bottom)
centre = Vector(((lo_c.x + hi_c.x) / 2, (lo_c.y + hi_c.y) / 2, 0))
placed = []
# No plate dips below the rocks' foot line.
FOOT_Z = 0.12

def coral(model, width, x, y, play=0.0, sink=0.35):
    """A table about `width` m wide whose foot stands on the rock at (x, y), or on the nearest
    ledge walking in toward the rock's centre, shrunk if need be. Kept only where its foot is in
    the rock, its plate stays out of the rock (a few points of contact read as growing from it)
    and above the rocks' foot, and it clears every plate already placed, as in the tank
    (coralPlacement.js)."""
    shape = shapes[model]
    cx, cy = shape['centre']
    reasons = {}
    for shrink in (1.0, 0.85, 0.7):
        s = width * shrink / (2 * shape['radius'])
        for step in range(14):
            t = 1 - step * 0.05
            px, py = centre.x + (x - centre.x) * t, centre.y + (y - centre.y) * t
            hit = nearest(trees, Vector((px, py, 10)), Vector((0, 0, -1)))
            if hit is None or hit[1].z < 0.35:
                reasons['no ledge'] = reasons.get('no ledge', 0) + 1
                continue
            foot = Vector((px, py, hit[0].z - shape['height'] * s * sink))
            if not inside(trees, foot + Vector((0, 0, 0.02))):
                reasons['foot out'] = reasons.get('foot out', 0) + 1
                continue
            out = math.atan2(py - centre.y, px - centre.x)
            rotation = Matrix.Rotation(out - math.atan2(cy, cx) + play, 4, 'Z')
            matrix = Matrix.Translation(foot) @ rotation @ Matrix.Scale(s, 4)
            plate = (matrix @ Vector((cx, cy, shape['height'] * 0.8)), shape['radius'] * s, shape['height'] * s * 0.4)
            clash = any(math.hypot(plate[0].x - o[0].x, plate[0].y - o[0].y) < (plate[1] + o[1]) * 0.95
                        and abs(plate[0].z - o[0].z) < (plate[2] + o[2]) / 2 + 0.15 for o in plates)
            if clash:
                reasons['clash'] = reasons.get('clash', 0) + 1
                continue
            buried = sum(1 for v in shape['samples'] if inside(trees, matrix @ v))
            if buried > 5 or any((matrix @ v).z < FOOT_Z + 0.12 for v in shape['samples']):
                reasons['buried'] = reasons.get('buried', 0) + 1
                continue
            obj = coral_kit[f'coral{model}_hi'].copy()
            obj.name = f'table_{len(placed)}'
            scene.collection.objects.link(obj)
            obj.hide_render = False
            obj.hide_set(False)
            obj.matrix_world = matrix
            placed.append(obj)
            plates.append(plate)
            print('CORAL', obj.name, 'model', model, 'width', round(width * shrink, 2), 'at', (round(px, 2), round(py, 2)),
                  'plate z', round(plate[0].z, 2), 'samples inside', buried)
            return
    print('CORAL skipped', model, width, (round(x, 2), round(y, 2)), reasons)

plates = []

# As in Jeremy's photo of a bommie: one huge table on the lump at the front-right foot, spreading
# out low from it, a big one low on the lump at the front-left, three small tables on
# the block's top on their stalks, and more around its shoulders, so the plates crown the rock.
# Spots are (angle in degrees, -90 = the front the Atlas faces, +x to its right; share of the
# block's half-size out from its centre). The huge one and the top three go first: the rest walk
# in or shrink to clear them.
lo_b, hi_b = world_bounds(bottom)
half = ((hi_b.x - lo_b.x) / 2, (hi_b.y - lo_b.y) / 2)

def around(model, width, angle, reach, play=0.0, sink=0.35):
    a = math.radians(angle)
    coral(model, width, centre.x + math.cos(a) * half[0] * reach, centre.y + math.sin(a) * half[1] * reach, play, sink)

around(1, 2.8, -20, 1.2, play=0.1)                  # the huge pink table, on the front-right lump
around(0, 0.95, 25, 0.45, play=0.5, sink=0.25)      # top, right, on its stalk
around(2, 0.7, -160, 0.45, play=0.2, sink=0.25)     # top, left
around(0, 0.8, 120, 0.4, play=0.4, sink=0.25)       # top, back
around(0, 1.8, -140, 1.15, play=0.3)                # big cream table on the lump, front-left
around(1, 1.3, 170, 0.95, play=0.2)                 # pink, left shoulder
around(0, 1.4, 60, 0.95, play=0.2)                  # cream, back-right shoulder
around(1, 1.0, -90, 0.75, play=0.1)                 # pink, front shoulder
around(2, 0.6, -45, 0.8, play=0.0)                  # small, front-right shoulder

# Centre the cluster on the origin.
objs = rocks + placed
update()
lo = Vector((min(world_bounds(o)[0].x for o in objs), min(world_bounds(o)[0].y for o in objs), min(world_bounds(o)[0].z for o in objs)))
hi = Vector((max(world_bounds(o)[1].x for o in objs), max(world_bounds(o)[1].y for o in objs), max(world_bounds(o)[1].z for o in objs)))
shift = -(lo + hi) / 2
for o in rocks:
    o.data.transform(Matrix.Translation(shift))
for o in placed:
    o.matrix_world = Matrix.Translation(shift) @ o.matrix_world
update()
print('BOUNDS', tuple(round(v, 3) for v in (hi - lo)))

bpy.ops.object.select_all(action='DESELECT')
for o in objs:
    o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
os.makedirs(os.path.dirname(out_path), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=True, export_image_format='JPEG',
                          export_texcoords=True, export_normals=True, export_yup=True, export_animations=False)
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
    # The Atlas turns the model by its pose's yawOffset (-0.4) and looks 30 degrees down: the
    # same as the camera turned +0.4 about the cluster.
    atlas_view = Vector((-math.sin(0.4), math.cos(0.4), -math.tan(math.radians(30))))
    for name, direction in [('atlas', atlas_view), ('front', Vector((0, 1, -0.05)))]:
        d = direction.normalized()
        cam.location = -d * 8
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(preview_dir, f'atlas_{name}.png')
        bpy.ops.render.render(write_still=True)
    print('PREVIEW', preview_dir)
