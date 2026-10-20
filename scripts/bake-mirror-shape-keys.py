# Export a GLB from a .blend whose mirrored body mesh has shape keys.
#
# The glTF exporter drops shape keys from a mesh with live modifiers, and Blender cannot apply a
# Mirror to a mesh with shape keys. So, on a COPY of the .blend (never the open scene): one copy
# of the body per key with that key's mix applied and the Mirror applied without its merge (every
# copy then has the same vertices), joined back as shape keys; the centre seam welded as the
# Mirror does (each vertex with its own mirror copy, at their midpoint, in every shape); then the
# meshes exported with their morph targets. Checked against Jeremy's own export of the open
# shape (raccoon butterflyfish, 2026-10-21): the same 1562 triangles, positions and UVs.
#
#   blender -b --factory-startup copy.blend --python scripts/bake-mirror-shape-keys.py -- out.glb "<body object>"
import bpy, sys, json
args = sys.argv[sys.argv.index("--") + 1:]
out = args[0]
body = bpy.data.objects[args[1]]
keys = [kb.name for kb in body.data.shape_keys.key_blocks]
coll = body.users_collection[0]
mirror = next(m for m in body.modifiers if m.type == 'MIRROR')
merge_on, merge_dist = mirror.use_mirror_merge, mirror.merge_threshold

def activate(ob):
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob

def baked_copy(key_name):
    ob = body.copy()
    ob.data = body.data.copy()
    coll.objects.link(ob)
    for kb in ob.data.shape_keys.key_blocks:
        kb.value = 1.0 if kb.name == key_name else 0.0
    activate(ob)
    bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    for mod in list(ob.modifiers):
        if mod.type == 'MIRROR':
            mod.use_mirror_merge = False
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob

base = baked_copy(keys[0])
others = [(name, baked_copy(name)) for name in keys[1:]]
bpy.ops.object.select_all(action='DESELECT')
for name, ob in others:
    ob.select_set(True)
base.select_set(True)
bpy.context.view_layer.objects.active = base
bpy.ops.object.join_shapes()
kbs = base.data.shape_keys.key_blocks
kbs[0].name = keys[0]
for (name, ob), kb in zip(others, list(kbs)[1:]):
    kb.name = name
    kb.value = 0.0
for _, ob in others:
    bpy.data.objects.remove(ob)
before = len(base.data.vertices)
if merge_on:
    # As the Mirror modifier merges: each original vertex with its own mirrored copy (index + n
    # with the merge off), where the two lie within the merge distance in the basis, and nothing
    # else. A plain merge-by-distance also fused nearby non-mirror points (30 triangles lost).
    import bmesh
    axis = [i for i, on in enumerate(mirror.use_axis) if on]
    n = len(body.data.vertices)
    bm = bmesh.new()
    bm.from_mesh(base.data)
    bm.verts.ensure_lookup_table()
    targets = {}
    for i in range(n):
        v, m = bm.verts[i], bm.verts[i + n]
        if (v.co - m.co).length <= merge_dist:
            # Mirror welds a pair at its midpoint, in every shape.
            v.co = (v.co + m.co) / 2
            for layer in bm.verts.layers.shape.values():
                v[layer] = (v[layer] + m[layer]) / 2
            targets[m] = v
    bmesh.ops.weld_verts(bm, targetmap=targets)
    bm.to_mesh(base.data)
    bm.free()
body_name = body.name
bpy.data.objects.remove(body)
base.name = body_name
bpy.ops.object.select_all(action='DESELECT')
for ob in bpy.data.objects:
    if ob.type == 'MESH':
        ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=True, export_morph=True)
print("BAKED", json.dumps({"keys": [kb.name for kb in base.data.shape_keys.key_blocks], "verts_before_weld": before, "verts": len(base.data.vertices), "merge": [merge_on, merge_dist], "axes": [i for i, on in enumerate(mirror.use_axis) if on], "mirror_object": str(mirror.mirror_object)}))
