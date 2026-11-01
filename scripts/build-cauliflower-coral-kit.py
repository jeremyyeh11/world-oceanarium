# Builds the cauliflower coral kit (Pocillopora meandrina) from Jeremy's cauliflower coral GLB,
# headless, without touching an open Blender scene:
#
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
#     --python scripts/build-cauliflower-coral-kit.py -- <source.glb> public/models/landscape [preview-dir]
#
# Model contract: each colony is one mesh object (several colonies in one GLB are fine), dome up
# (+Y in glTF), with its object origin at the foot, in the middle: the point that sits on the rock
# (docs/new-species-checklist.md: a coral's origin is its root, never a computed lowest point). Any
# materials: photo textures, vertex colour or plain colours all bake. Any size: the source is scaled
# so its biggest colony is BIGGEST_M across, the others in proportion.
#
# A copy of scripts/build-brain-coral-kit.py (the staghorn's kit script predates the origin rule and
# the seam fix): each colony is scaled, welded, moved so its origin is at (0, 0, 0), decimated to a
# close-up mesh (cauliflowerN_hi) and unwrapped; the full-detail source (Jeremy's displaced lobes,
# 2026-11-01: 55,000 to 290,000 triangles) is then baked onto it: its colour into
# cauliflowerN-color.jpg and its surface into a tangent-space cauliflowerN-normal.jpg.
# cauliflowerN_lo and cauliflowerN_far are decimated from cauliflowerN_hi and share its UVs and maps.
# Largest first, so cauliflower0 is the biggest. The output names match landscapes.js
# CAULIFLOWER_CORAL_KIT; it prints one line per mesh and map. The Atlas specimen is built from the
# kit by scripts/build-cauliflower-coral-atlas.py.

import bpy, bmesh, sys, os
from mathutils import Matrix

args = sys.argv[sys.argv.index('--') + 1:]
src, out_dir = args[0], os.path.abspath(args[1])
preview_dir = args[2] if len(args) > 2 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene
os.makedirs(out_dir, exist_ok=True)
sources = sorted([o for o in scene.objects if o.type == 'MESH'], key=lambda o: -max(o.dimensions))
print('SOURCES', [(o.name, tuple(round(d, 3) for d in o.dimensions), len(o.data.polygons)) for o in sources])

# Colonies are commonly 20-40 cm across, most stopping near 40 cm (NMFS 2019 status review); the
# biggest of Jeremy's three becomes 45 cm (his are 3.6, 5.6 and 8.1 m: 20, 31 and 45 cm).
BIGGEST_M = 0.45
SCALE = BIGGEST_M / max(max(o.dimensions[0], o.dimensions[1]) for o in sources)
print('SCALE', round(SCALE, 5))

# Triangle targets and map size per colony, by its width (m). The lobes and the grooves between
# them are what make it a cauliflower coral, and they have to survive at _far (the back of the
# reef), so the levels keep more triangles than a brain coral's dome of the same size.
def plan(width, tris):
    hi = min(tris, 6000 if width > 0.3 else 3000)
    return {'hi': hi, 'lo': max(60, round(hi * 0.4)), 'far': max(40, round(hi * 0.16)),
            'tex': 1024 if width > 0.3 else 512}

def tri_count(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)

def weld(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0002)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()

# Collapsing an edge across a UV island's seam leaves a triangle whose UVs span the gap between
# islands, which the bake leaves black (scripts/build-brain-coral-kit.py). The close-up mesh keeps
# its seam vertices in this group, which the decimation leaves alone.
SEAM_GROUP = 'uv_seams'
# Smart UV Project's angle limit: the brain coral's 66 degrees cuts these lobes into so many islands
# that the protected seams leave almost nothing for _lo and _far to collapse.
ANGLE_LIMIT = 1.45
PROTECT_SEAMS = False

def mark_seams(obj):
    select_only([obj], obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.seams_from_islands()
    bpy.ops.object.mode_set(mode='OBJECT')
    seam_verts = {v for e in obj.data.edges if e.use_seam for v in e.vertices}
    group = obj.vertex_groups.new(name=SEAM_GROUP)
    group.add(list(seam_verts), 1.0, 'REPLACE')
    return len(seam_verts)

# Triangles of `obj` whose UVs land on near-black texels of the baked colour map (`px`, RGBA
# floats, `w` by `h`; sampled at each triangle's centre and halfway to each corner): the check for
# the seam fault above. The grooves are dark on purpose, so this counts a few true ones too.
def black_triangles(obj, px, w, h):
    uv = obj.data.uv_layers.active.data
    def lum(u, v):
        x = min(w - 1, max(0, int(u * w))); y = min(h - 1, max(0, int(v * h)))
        i = (y * w + x) * 4
        return (px[i] + px[i + 1] + px[i + 2]) / 3
    count = 0
    obj.data.calc_loop_triangles()
    for tri in obj.data.loop_triangles:
        corners = [uv[l].uv for l in tri.loops]
        cu = sum(c[0] for c in corners) / 3; cv = sum(c[1] for c in corners) / 3
        samples = [lum(cu, cv)] + [lum((cu + c[0]) / 2, (cv + c[1]) / 2) for c in corners]
        if sum(samples) / len(samples) < 0.03:
            count += 1
    return count

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
        if SEAM_GROUP in copy.vertex_groups:
            mod.vertex_group = SEAM_GROUP
            mod.invert_vertex_group = True
            mod.vertex_group_factor = 10
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
# Wide enough to fill the gaps between the islands, so a triangle that still spans one shows the
# neighbouring colour, never black.
scene.render.bake.margin = 48
scene.render.bake.margin_type = 'EXTEND'
scene.render.bake.use_selected_to_active = True
# In metres at true size: the decimated lobes stray a few millimetres from the source's.
scene.render.bake.cage_extrusion = 0.006
scene.render.bake.max_ray_distance = 0.015

exported = []
for index, src_obj in enumerate(sources):
    # Bake the object's transform and the kit scale into its mesh, about its origin (his root): the
    # origin stays at (0, 0, 0), the colony keeps its rotation.
    origin = src_obj.matrix_world.translation.copy()
    src_obj.data.transform(Matrix.Scale(SCALE, 4) @ Matrix.Translation(-origin) @ src_obj.matrix_world)
    src_obj.parent = None
    src_obj.matrix_world.identity()
    src_obj.data.update()
    weld(src_obj)
    bpy.context.view_layer.update()
    low = min(v.co.z for v in src_obj.data.vertices)
    width = max(src_obj.dimensions[0], src_obj.dimensions[1])
    print('ORIGIN', src_obj.name, 'below origin', round(max(0.0, -low), 4), 'm; width', round(width, 3),
          'height above origin', round(max(v.co.z for v in src_obj.data.vertices), 3))

    p = plan(width, tri_count(src_obj.data))
    hi = decimated(src_obj, p['hi'], f'cauliflower{index}_hi')
    # Fresh UVs on the close-up mesh for the bake.
    while hi.data.uv_layers:
        hi.data.uv_layers.remove(hi.data.uv_layers[0])
    hi.data.uv_layers.new(name='UVMap')
    hi.data.materials.clear()
    select_only([hi], hi)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=ANGLE_LIMIT, island_margin=0.006, area_weight=1.0, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    if PROTECT_SEAMS:
        print("SEAMS", hi.name, mark_seams(hi), "seam vertices")

    # One bake target material holding the image being written.
    mat = bpy.data.materials.new(f'cauliflower{index}_bake')
    mat.use_nodes = True
    hi.data.materials.append(mat)
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    mat.node_tree.nodes.active = node

    for kind in ('color', 'normal'):
        img = bpy.data.images.new(f'cauliflower{index}-{kind}', p['tex'], p['tex'], alpha=False)
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
        if kind == 'color':
            color_px = img.pixels[:]
        path = os.path.join(out_dir, f'cauliflower{index}-{kind}.jpg')
        img.file_format = 'JPEG'
        img.save(filepath=path, quality=88)
        print('TEX', path, os.path.getsize(path))

    lo = decimated(hi, p['lo'], f'cauliflower{index}_lo')
    far = decimated(hi, p['far'], f'cauliflower{index}_far')
    for o in (hi, lo, far):
        o.data.materials.clear()
        print('LOD', o.name, tri_count(o.data), 'dims', tuple(round(d, 3) for d in o.dimensions),
              'black triangles', black_triangles(o, color_px, p['tex'], p['tex']))
        while o.vertex_groups:
            o.vertex_groups.remove(o.vertex_groups[0])
        exported.append(o)

for o in list(scene.objects):
    if o not in exported:
        bpy.data.objects.remove(o, do_unlink=True)

if preview_dir:
    # Each level side by side, textured, for a look before shipping: columns per colony, rows
    # hi / lo / far, seen from the side and a little above.
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 1500
    scene.render.resolution_y = 1100
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
    # The kit meshes themselves stay at the origin, untextured: out of the render.
    for o in exported:
        o.hide_render = True
    for i, o in enumerate(exported):
        index, row = divmod(i, 3)
        mat = bpy.data.materials.new(f'show{i}')
        mat.use_nodes = True
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        bsdf = nodes['Principled BSDF']
        bsdf.inputs['Roughness'].default_value = 0.95
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(os.path.join(out_dir, f'cauliflower{index}-color.jpg'), check_existing=True)
        links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        ntex = nodes.new('ShaderNodeTexImage')
        ntex.image = bpy.data.images.load(os.path.join(out_dir, f'cauliflower{index}-normal.jpg'), check_existing=True)
        ntex.image.colorspace_settings.name = 'Non-Color'
        nmap = nodes.new('ShaderNodeNormalMap')
        links.new(ntex.outputs['Color'], nmap.inputs['Color'])
        links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
        show = o.copy()
        show.data = o.data.copy()
        show.data.materials.append(mat)
        show.hide_render = False
        show.location = (index * 0.6, 0, -row * 0.45)
        scene.collection.objects.link(show)
        shown.append(show)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 2.2
    cam.location = (0.6, -3, -0.3)
    cam.rotation_euler = (1.35, 0, 0)
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.filepath = os.path.join(preview_dir, 'cauliflower-kit-lods.png')
    bpy.ops.render.render(write_still=True)
    print('PREVIEW', scene.render.filepath)
    for o in shown:
        bpy.data.objects.remove(o, do_unlink=True)
    for o in exported:
        o.hide_render = False

select_only(exported, exported[0])
glb = os.path.join(out_dir, 'cauliflower-corals.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_materials='NONE',
                          export_texcoords=True, export_normals=True, export_yup=True, export_animations=False)
print('GLB', glb, os.path.getsize(glb), 'models', len(sources))
