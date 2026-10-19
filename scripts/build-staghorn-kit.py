# Builds the staghorn coral kit (Acropora muricata) from Jeremy's staghorn GLB, headless, without
# touching an open Blender scene:
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#     --python scripts/build-staghorn-kit.py -- <source.glb> public/models/landscape [preview-dir]
#
# The source (2026-10-20) holds 13 upright colonies stacked at the origin, in three colours (blue,
# cream and orange-brown, each with its own photo texture), several of them rotated copies of the
# same mesh. The kit keeps two per colour, a big and a small one, so a thicket mixes sizes and
# colours. As in scripts/build-coral-kit.py, each is welded, moved so its origin is the middle of
# its base (the point that sinks into sand), decimated to a close-up mesh (staghornN_hi), and
# unwrapped; the full-detail source is baked onto it, its photo colour into staghornN-color.jpg
# and its surface (the corallites along the branches) into a tangent-space staghornN-normal.jpg.
# staghornN_lo and staghornN_far are decimated from staghornN_hi and share its UVs and maps.
# Branches are thin, so the meshes keep more triangles than a table of the same size: the
# decimator otherwise pinches a branch tip off.

import bpy, bmesh, sys, os
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index('--') + 1:]
src, out_dir = args[0], os.path.abspath(args[1])
preview_dir = args[2] if len(args) > 2 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene

# The kit's colonies by source object name, in kit order: per colour the biggest and a small one.
KEEP = ['orange.001', 'orange.002', 'cream.004', 'cream.001', 'blue.004', 'blue.002']
by_name = {o.name: o for o in scene.objects if o.type == 'MESH'}
sources = [by_name[name] for name in KEEP]

# Triangle targets and map size per colony, by its largest dimension (m).
def plan(size):
    if size > 1.0:
        return {'hi': 3500, 'lo': 1100, 'far': 300, 'tex': 1024}
    if size > 0.6:
        return {'hi': 2500, 'lo': 800, 'far': 220, 'tex': 512}
    return {'hi': 1800, 'lo': 600, 'far': 160, 'tex': 512}

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
scene.render.bake.cage_extrusion = 0.01
scene.render.bake.max_ray_distance = 0.03

exported = []
for index, src_obj in enumerate(sources):
    weld(src_obj)
    # Origin at the base: the middle of the lowest 4 cm of the mesh, at its lowest z.
    verts = [src_obj.matrix_world @ v.co for v in src_obj.data.vertices]
    min_z = min(v.z for v in verts)
    foot = [v for v in verts if v.z < min_z + 0.04]
    base = Vector((sum(v.x for v in foot) / len(foot), sum(v.y for v in foot) / len(foot), min_z))
    src_obj.data.transform(src_obj.matrix_world)
    src_obj.matrix_world.identity()
    src_obj.data.transform(Matrix.Translation(-base))
    src_obj.data.update()

    bpy.context.view_layer.update()
    p = plan(max(src_obj.dimensions))
    hi = decimated(src_obj, p['hi'], f'staghorn{index}_hi')
    while hi.data.uv_layers:
        hi.data.uv_layers.remove(hi.data.uv_layers[0])
    hi.data.uv_layers.new(name='UVMap')
    hi.data.materials.clear()
    select_only([hi], hi)
    # Smooth shading without the source's custom normals: flat or split normals would make the
    # glTF export give every triangle its own three vertices.
    bpy.ops.mesh.customdata_custom_splitnormals_clear()
    for poly in hi.data.polygons:
        poly.use_smooth = True
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    # A wide angle limit (80 degrees): a decimated branch is a five- or six-sided tube, and at
    # the table kit's 66 degrees every one of its faces became an island of its own.
    bpy.ops.uv.smart_project(angle_limit=1.4, island_margin=0.006, area_weight=1.0, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')

    mat = bpy.data.materials.new(f'staghorn{index}_bake')
    mat.use_nodes = True
    hi.data.materials.append(mat)
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    mat.node_tree.nodes.active = node

    for kind in ('color', 'normal'):
        img = bpy.data.images.new(f'staghorn{index}-{kind}', p['tex'], p['tex'], alpha=False)
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
        path = os.path.join(out_dir, f'staghorn{index}-{kind}.jpg')
        img.file_format = 'JPEG'
        img.save(filepath=path, quality=88)
        print('TEX', path, os.path.getsize(path))

    lo = decimated(hi, p['lo'], f'staghorn{index}_lo')
    far = decimated(hi, p['far'], f'staghorn{index}_far')
    for o in (hi, lo, far):
        o.data.materials.clear()
        print('LOD', src_obj.name, o.name, tri_count(o.data), 'dims', tuple(round(d, 3) for d in o.dimensions))
        exported.append(o)

for o in list(scene.objects):
    if o not in exported:
        bpy.data.objects.remove(o, do_unlink=True)

if preview_dir:
    # Each LOD side by side, textured, for a look before shipping: rows hi / lo / far.
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 1000
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('w')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.06, 0.14, 0.32, 1)
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3
    sun.rotation_euler = (0.6, 0.2, 0.8)
    scene.collection.objects.link(sun)
    shown = []
    for i, o in enumerate(exported):
        index, row = divmod(i, 3)
        mat = bpy.data.materials.new(f'show{i}')
        mat.use_nodes = True
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        bsdf = nodes['Principled BSDF']
        bsdf.inputs['Roughness'].default_value = 0.95
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(os.path.join(out_dir, f'staghorn{index}-color.jpg'))
        links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        ntex = nodes.new('ShaderNodeTexImage')
        ntex.image = bpy.data.images.load(os.path.join(out_dir, f'staghorn{index}-normal.jpg'))
        ntex.image.colorspace_settings.name = 'Non-Color'
        nmap = nodes.new('ShaderNodeNormalMap')
        links.new(ntex.outputs['Color'], nmap.inputs['Color'])
        links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
        show = o.copy()
        show.data = o.data.copy()
        show.data.materials.append(mat)
        show.location = (index * 1.9, 0, -row * 1.9)
        scene.collection.objects.link(show)
        shown.append(show)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 11.6
    cam.location = (4.75, -20, -1.1)
    cam.rotation_euler = (1.5708, 0, 0)
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.filepath = os.path.join(preview_dir, 'staghorn-kit-lods.png')
    bpy.ops.render.render(write_still=True)
    print('PREVIEW', scene.render.filepath)
    for o in shown:
        bpy.data.objects.remove(o, do_unlink=True)

select_only(exported, exported[0])
glb = os.path.join(out_dir, 'staghorn-corals.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_materials='NONE',
                          export_texcoords=True, export_normals=True, export_yup=True, export_animations=False)
print('GLB', glb, os.path.getsize(glb))
