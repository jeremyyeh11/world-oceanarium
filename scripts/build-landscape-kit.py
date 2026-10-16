# Builds a landscape rock kit from one of Jeremy's rock GLBs, headless, without touching
# an open Blender scene:
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#     --python scripts/build-landscape-kit.py -- <source.glb> public/models/landscape
#
# Per source rock it writes rockN_hi (at most 3000 triangles), rockN_lo (600; 120 for the
# small rocks) and, for the small rocks, rockN_rubble (40) into limestone-boulders.glb, with
# no UVs or materials: Landscape.jsx re-projects UVs per placed piece. Faces are welded
# before decimating, or the decimator tears each face off on its own. The three texture
# maps are resized to 1024 px JPEGs beside it.

import bpy, sys, os
args = sys.argv[sys.argv.index('--') + 1:]
src, out_dir = args
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene
sources = sorted([o for o in scene.objects if o.type == 'MESH'], key=lambda o: o.name)

def tri_count(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)

# LOD targets in triangles: hi for close-up pieces, lo for distant ones, rubble for the
# instanced chunks (small rocks only).
TARGETS = {'hi': 3000, 'lo': 600}
SMALL = {'rock.005', 'rock.006', 'rock.007'}
made = []
depsgraph = bpy.context.evaluated_depsgraph_get()
import bmesh
for index, src_obj in enumerate(sources):
    # UVs are re-projected at runtime; dropping them frees the decimator from UV seams.
    while src_obj.data.uv_layers:
        src_obj.data.uv_layers.remove(src_obj.data.uv_layers[0])
    # The glTF import leaves faces split apart (one vertex copy per face corner on flat
    # faces). Weld them first, or the decimator collapses each face on its own and tears the
    # rock into shards; then point every face outward.
    bm = bmesh.new()
    bm.from_mesh(src_obj.data)
    before = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.001)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    loose = len([e for e in bm.edges if e.is_boundary])
    bm.to_mesh(src_obj.data)
    bm.free()
    print('WELD', src_obj.name, before, '->', len(src_obj.data.vertices), 'boundaryEdges', loose)
    base_tris = tri_count(src_obj.data)
    lods = dict(TARGETS)
    if src_obj.name in SMALL:
        lods = {'hi': base_tris, 'lo': 120, 'rubble': 40}
    for lod, target in lods.items():
        obj = src_obj.copy()
        obj.data = src_obj.data.copy()
        obj.name = f'rock{index}_{lod}'
        obj.location = (0, 0, 0)
        scene.collection.objects.link(obj)
        if target < base_tris:
            mod = obj.modifiers.new('decimate', 'DECIMATE')
            mod.ratio = target / base_tris
            depsgraph = bpy.context.evaluated_depsgraph_get()
            mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
            obj.modifiers.clear()
            obj.data = mesh
        obj.data.materials.clear()
        made.append(obj)
        print('LOD', obj.name, 'from', src_obj.name, base_tris, '->', tri_count(obj.data), 'dims', tuple(round(d, 2) for d in obj.dimensions))
for o in sources:
    bpy.data.objects.remove(o, do_unlink=True)

bpy.ops.object.select_all(action='SELECT')
glb = os.path.join(out_dir, 'limestone-boulders.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_materials='NONE', export_texcoords=False, export_normals=True, export_yup=True, export_animations=False)
print('GLB', glb, os.path.getsize(glb))

names = {'GWC Rock 008_base_color': 'limestone-color.jpg', 'GWC Rock 008_normal': 'limestone-normal.jpg', 'GWC Rock 008_roughness': 'limestone-roughness.jpg'}
for img in list(bpy.data.images):
    if img.name not in names:
        continue
    img.scale(1024, 1024)
    path = os.path.join(out_dir, names[img.name])
    img.file_format = 'JPEG'
    img.save(filepath=path, quality=85)
    print('TEX', path, os.path.getsize(path))
