# Builds the table coral kit (Acropora hyacinthus) from Jeremy's coral GLB, headless, without touching an open Blender
# scene:
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#     --python scripts/build-coral-kit.py -- <source.glb> public/models/landscape
#
# Each source coral is welded, moved so its origin is the bottom of its stalk (the point that
# sinks into rock), decimated to a close-up mesh (coralN_hi) and a distant one (coralN_lo),
# and unwrapped. The full-detail source is then baked onto coralN_hi: its photo colour into
# coralN-color.jpg and its surface detail (the bristly branch tips) into a tangent-space
# coralN-normal.jpg, so the phone draws a few thousand triangles and keeps the look. coralN_lo
# (mid-distance) and coralN_far (the back of the reef) are decimated from coralN_hi and share
# its UVs and maps. The Atlas specimen, a cluster of these tables on a small rock, is built from
# the kit by scripts/build-coral-atlas.py.

import bpy, bmesh, sys, os
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index('--') + 1:]
src, out_dir = args[0], args[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene
# Largest first, so coral0 is the biggest table.
sources = sorted([o for o in scene.objects if o.type == 'MESH'], key=lambda o: -max(o.dimensions))

# Triangle targets and map size per coral, by plate width (m).
def plan(width):
    if width > 1.5:
        return {'hi': 3000, 'lo': 700, 'far': 160, 'tex': 1024}
    return {'hi': 1400, 'lo': 300, 'far': 60, 'tex': 512}

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
    weld(src_obj)
    # Origin at the stalk's foot: the centre of the lowest 3 cm of the mesh, at its lowest z.
    verts = [src_obj.matrix_world @ v.co for v in src_obj.data.vertices]
    min_z = min(v.z for v in verts)
    foot = [v for v in verts if v.z < min_z + 0.03]
    base = Vector((sum(v.x for v in foot) / len(foot), sum(v.y for v in foot) / len(foot), min_z))
    src_obj.data.transform(src_obj.matrix_world)
    src_obj.matrix_world.identity()
    src_obj.data.transform(Matrix.Translation(-base))
    src_obj.data.update()

    p = plan(max(src_obj.dimensions[0], src_obj.dimensions[1]))
    hi = decimated(src_obj, p['hi'], f'coral{index}_hi')
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
    mat = bpy.data.materials.new(f'coral{index}_bake')
    mat.use_nodes = True
    hi.data.materials.append(mat)
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    mat.node_tree.nodes.active = node

    for kind in ('color', 'normal'):
        img = bpy.data.images.new(f'coral{index}-{kind}', p['tex'], p['tex'], alpha=False)
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
        path = os.path.join(out_dir, f'coral{index}-{kind}.jpg')
        img.file_format = 'JPEG'
        img.save(filepath=path, quality=88)
        print('TEX', path, os.path.getsize(path))

    lo = decimated(hi, p['lo'], f'coral{index}_lo')
    far = decimated(hi, p['far'], f'coral{index}_far')
    for o in (hi, lo, far):
        o.data.materials.clear()
        print('LOD', o.name, tri_count(o.data), 'dims', tuple(round(d, 3) for d in o.dimensions))
        exported.append(o)

for o in list(scene.objects):
    if o not in exported:
        bpy.data.objects.remove(o, do_unlink=True)
select_only(exported, exported[0])
glb = os.path.join(out_dir, 'table-corals.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_materials='NONE',
                          export_texcoords=True, export_normals=True, export_yup=True, export_animations=False)
print('GLB', glb, os.path.getsize(glb))

