# Builds the brain coral kit (Platygyra daedalea) from Jeremy's brain coral GLB, headless, without
# touching an open Blender scene:
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#     --python scripts/build-brain-coral-kit.py -- <source.glb> public/models/landscape
#
# Model contract: each colony is one mesh object (several colonies in one GLB are fine), in
# metres, dome up (+Y in glTF), with its object origin on its ground line, in the middle: the point
# that sits on the rock or sand (docs/new-species-checklist.md: a coral's origin is its root, never
# a computed lowest point). Mesh below the origin is the buried underside: placement sinks it into
# rock or sand (src/components/brainCoralPlacement.js). Any materials: photo textures, vertex colour
# or plain colours all bake.
#
# Like the table corals (scripts/build-coral-kit.py), each colony is welded, moved so its origin
# is at (0, 0, 0), decimated to a close-up mesh (brainN_hi) and unwrapped; the full-detail source is
# then baked onto it: its colour into brainN-color.jpg and its surface (the maze of valleys and
# walls) into a tangent-space brainN-normal.jpg, so the phone draws a couple of thousand triangles
# a colony and keeps the look. brainN_lo (mid-distance) and brainN_far (the back of the reef) are
# decimated from brainN_hi and share its UVs and maps. Largest first, so brain0 is the biggest.
# The output names match landscapes.js BRAIN_CORAL_KIT; it prints one line per mesh and map, so
# set the kit's `models` to the colonies it made. The Atlas specimen is built from the kit by
# scripts/build-brain-coral-atlas.py.

import bpy, bmesh, sys, os
from mathutils import Matrix

args = sys.argv[sys.argv.index('--') + 1:]
src, out_dir = args[0], args[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene
os.makedirs(out_dir, exist_ok=True)
sources = sorted([o for o in scene.objects if o.type == 'MESH'], key=lambda o: -max(o.dimensions))
print('SOURCES', [(o.name, tuple(round(d, 3) for d in o.dimensions), len(o.data.polygons)) for o in sources])

# Triangle targets and map size per colony, by its width (m) and its own triangle count: a dome is
# simple in outline, its detail is in the maps. A source lighter than the cap keeps its triangles
# at _hi (Jeremy's 2026-10-30 colonies are 256 to 768).
def plan(width, tris):
    hi = min(tris, 2400 if width > 0.6 else 1200)
    return {'hi': hi, 'lo': max(60, round(hi * 0.45)), 'far': max(40, round(hi * 0.18)),
            'tex': 1024 if width > 0.6 else 512}

def tri_count(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)

def weld(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()

def decimated(obj, target, name):
    copy = obj.copy()
    copy.data = obj.data.copy()
    copy.name = name
    copy.data.name = name
    scene.collection.objects.link(copy)
    base = tri_count(copy.data)
    if target < base:
        mod = copy.modifiers.new('decimate', 'DECIMATE')
        mod.ratio = target / base
        depsgraph = bpy.context.evaluated_depsgraph_get()
        mesh = bpy.data.meshes.new_from_object(copy.evaluated_get(depsgraph))
        copy.modifiers.clear()
        copy.data = mesh
        mesh.name = name
    return copy

def select_only(objs, active):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active

scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 4
scene.render.bake.margin = 8
scene.render.bake.use_selected_to_active = True
scene.render.bake.cage_extrusion = 0.015
scene.render.bake.max_ray_distance = 0.04

exported = []
for index, src_obj in enumerate(sources):
    # Bake the object's transform into its mesh, about its origin (his root): the origin stays at
    # (0, 0, 0), the colony keeps its rotation and scale.
    origin = src_obj.matrix_world.translation.copy()
    src_obj.data.transform(Matrix.Translation(-origin) @ src_obj.matrix_world)
    src_obj.parent = None
    src_obj.matrix_world.identity()
    src_obj.data.update()
    weld(src_obj)
    low = min(v.co.z for v in src_obj.data.vertices)
    width = max(src_obj.dimensions[0], src_obj.dimensions[1])
    # His origin is the ground line: what hangs below it gets buried.
    print('ORIGIN', src_obj.name, 'buried below origin', round(max(0.0, -low), 3), 'm; width', round(width, 3),
          'height above origin', round(max(v.co.z for v in src_obj.data.vertices), 3))

    p = plan(width, tri_count(src_obj.data))
    hi = decimated(src_obj, p['hi'], f'brain{index}_hi')
    # Fresh UVs on the close-up mesh for the bake.
    while hi.data.uv_layers:
        hi.data.uv_layers.remove(hi.data.uv_layers[0])
    hi.data.uv_layers.new(name='UVMap')
    hi.data.materials.clear()
    select_only([hi], hi)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.006, area_weight=1.0, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')

    # One bake target material holding the image being written.
    mat = bpy.data.materials.new(f'brain{index}_bake')
    mat.use_nodes = True
    hi.data.materials.append(mat)
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    mat.node_tree.nodes.active = node

    for kind in ('color', 'normal'):
        img = bpy.data.images.new(f'brain{index}-{kind}', p['tex'], p['tex'], alpha=False)
        if kind == 'normal':
            img.colorspace_settings.name = 'Non-Color'
        node.image = img
        select_only([src_obj, hi], hi)
        if kind == 'color':
            scene.render.bake.use_pass_direct = False
            scene.render.bake.use_pass_indirect = False
            bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_selected_to_active=True)
        else:
            bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT', use_selected_to_active=True)
        path = os.path.join(out_dir, f'brain{index}-{kind}.jpg')
        img.file_format = 'JPEG'
        img.save(filepath=path, quality=88)
        print('TEX', path, os.path.getsize(path))

    lo = decimated(hi, p['lo'], f'brain{index}_lo')
    far = decimated(hi, p['far'], f'brain{index}_far')
    for o in (hi, lo, far):
        o.data.materials.clear()
        print('LOD', o.name, tri_count(o.data), 'dims', tuple(round(d, 3) for d in o.dimensions))
        exported.append(o)

for o in list(scene.objects):
    if o not in exported:
        bpy.data.objects.remove(o, do_unlink=True)
select_only(exported, exported[0])
glb = os.path.join(out_dir, 'brain-corals.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_materials='NONE',
                          export_texcoords=True, export_normals=True, export_yup=True, export_animations=False)
print('GLB', glb, os.path.getsize(glb), 'models', len(sources))
