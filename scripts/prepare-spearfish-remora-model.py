"""Cut Jeremy's retextured Spearfish Remora export's photo down to the fish and name its parts.

uv run --with pillow python scripts/prepare-spearfish-remora-model.py "path/to/remora brachyptera.glb"
Valid only for the hash below; geometry, node offsets and UV layout are kept as supplied.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import struct

from PIL import Image

SOURCE_SHA256 = 'b545d2050088d5a06c7a5898be0779d7e1e864e412e04fb085fefc16d8064c5d'
ROOT = Path(__file__).resolve().parents[1]
# The texture is Eric L. Chen's 2048 x 2048 photo (iNaturalist, CC BY-NC): one fish from above,
# the side and below on grey. The UVs use the upper two views only. Keep that rectangle plus a
# small margin, at most this wide.
CROP_MARGIN_PX = 8
MAX_TEXTURE_WIDTH = 1536
JPEG_QUALITY = 90
# Supplied node index -> runtime name. The fins keep their names; the body (index 4) carries the
# disc, dorsal, anal and caudal fins in one material.
NODE_NAMES = {0: 'pectoral.l', 1: 'pectoral.r', 2: 'pelvic.l', 3: 'pelvic.r', 4: 'remora_brachyptera'}


def prepare(source):
    data = source.read_bytes()
    if hashlib.sha256(data).hexdigest() != SOURCE_SHA256:
        raise ValueError('Unrecognised export; inspect it before changing this script')
    json_size = struct.unpack_from('<I', data, 12)[0]
    document = json.loads(data[20:20 + json_size])
    binary = bytearray(data[28 + json_size:])
    if len(document['nodes']) != 5 or any(node['mesh'] != index for index, node in enumerate(document['nodes'])):
        raise ValueError('Expected the body and four independent fins, one mesh each')
    if len(document['images']) != 1 or len(document['materials']) != 1:
        raise ValueError('Expected one photo on one material')

    def view_slice(view_id):
        view = document['bufferViews'][view_id]
        if 'byteStride' in view:
            raise ValueError('Expected tightly packed buffer views')
        start = view.get('byteOffset', 0)
        return start, start + view['byteLength']

    def floats(accessor_id, width):
        accessor = document['accessors'][accessor_id]
        if accessor['componentType'] != 5126 or accessor.get('byteOffset', 0):
            raise ValueError('Expected float32 accessors at the start of their views')
        start, _ = view_slice(accessor['bufferView'])
        values = [list(struct.unpack_from(f'<{width}f', binary, start + i * 4 * width))
                  for i in range(accessor['count'])]
        return accessor, start, values

    def store(start, values, width):
        for i, value in enumerate(values):
            struct.pack_into(f'<{width}f', binary, start + i * 4 * width, *value)

    for index, node in enumerate(document['nodes']):
        node['name'] = NODE_NAMES[index]
        document['meshes'][node['mesh']]['name'] = node['name']

    # The export merged the suction disc into the body. Split it back into its own primitive so
    # GLTFLoader loads it as `remora_brachyptera_2`, which follows the body rigidly instead of
    # waving. The disc is the faces whose UVs all fall in the photo's top view of the disc
    # (176 faces, sharing no vertex with the rest of the body).
    body_primitive, = document['meshes'][4]['primitives']
    index_accessor = document['accessors'][body_primitive['indices']]
    index_format = {5123: 'H', 5125: 'I'}[index_accessor['componentType']]
    index_start, _ = view_slice(index_accessor['bufferView'])
    indices = struct.unpack_from(f'<{index_accessor["count"]}{index_format}', binary, index_start)
    _, _, body_uvs = floats(body_primitive['attributes']['TEXCOORD_0'], 2)
    in_disc = lambda vertex: body_uvs[vertex][0] < 0.33 and body_uvs[vertex][1] < 0.29
    faces = [indices[i:i + 3] for i in range(0, len(indices), 3)]
    disc_faces = [face for face in faces if all(in_disc(v) for v in face)]
    body_faces = [face for face in faces if not any(in_disc(v) for v in face)]
    if len(disc_faces) != 176 or len(disc_faces) + len(body_faces) != len(faces):
        raise ValueError('Expected the disc as 176 faces apart from the body')
    widths = {'POSITION': 3, 'NORMAL': 3, 'TEXCOORD_0': 2}
    if set(body_primitive['attributes']) != set(widths):
        raise ValueError('Expected position, normal and one UV set on the body')
    sources = {name: floats(accessor_id, widths[name])[2] for name, accessor_id in body_primitive['attributes'].items()}

    def append(raw, target, accessor):
        binary.extend(b'\x00' * (-len(binary) % 4))
        document['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(raw), 'target': target})
        binary.extend(raw)
        document['accessors'].append({'bufferView': len(document['bufferViews']) - 1, **accessor})
        return len(document['accessors']) - 1

    # Each part gets its own vertices, so its bounds (which the rider fit reads) are its own.
    primitives = []
    for part in (body_faces, disc_faces):
        used = sorted({v for face in part for v in face})
        remap = {v: i for i, v in enumerate(used)}
        attributes = {}
        for name, width in widths.items():
            values = [sources[name][v] for v in used]
            accessor = {'componentType': 5126, 'count': len(values), 'type': f'VEC{width}'}
            if name == 'POSITION':
                stored = [struct.unpack('<3f', struct.pack('<3f', *v)) for v in values]
                accessor['min'] = [min(p[a] for p in stored) for a in range(3)]
                accessor['max'] = [max(p[a] for p in stored) for a in range(3)]
            raw = b''.join(struct.pack(f'<{width}f', *v) for v in values)
            attributes[name] = append(raw, 34962, accessor)
        flat = [remap[v] for face in part for v in face]
        indices_id = append(struct.pack(f'<{len(flat)}{index_format}', *flat), 34963,
                            {'componentType': index_accessor['componentType'], 'count': len(flat), 'type': 'SCALAR'})
        primitives.append({**body_primitive, 'attributes': attributes, 'indices': indices_id})
    document['meshes'][4]['primitives'] = primitives

    image_def = document['images'][0]
    start, end = view_slice(image_def['bufferView'])
    photo = Image.open(io.BytesIO(bytes(binary[start:end])))
    if photo.mode == 'RGBA' and photo.getchannel('A').getextrema() != (255, 255):
        raise ValueError('Expected a solid alpha channel')
    photo = photo.convert('RGB')
    every_primitive = [primitive for mesh in document['meshes'] for primitive in mesh['primitives']]
    uv_accessors = sorted({primitive['attributes']['TEXCOORD_0'] for primitive in every_primitive})
    if len(uv_accessors) != len(every_primitive):
        raise ValueError('Expected one UV accessor per primitive')
    uvs = {accessor_id: floats(accessor_id, 2) for accessor_id in uv_accessors}
    every_uv = [uv for _, _, values in uvs.values() for uv in values]
    width, height = photo.size
    left = max(0, int(min(u for u, _ in every_uv) * width) - CROP_MARGIN_PX)
    top = max(0, int(min(v for _, v in every_uv) * height) - CROP_MARGIN_PX)
    right = min(width, int(max(u for u, _ in every_uv) * width) + 1 + CROP_MARGIN_PX)
    bottom = min(height, int(max(v for _, v in every_uv) * height) + 1 + CROP_MARGIN_PX)
    crop = photo.crop((left, top, right, bottom))
    if crop.width > MAX_TEXTURE_WIDTH:
        crop = crop.resize((MAX_TEXTURE_WIDTH, round(crop.height * MAX_TEXTURE_WIDTH / crop.width)), Image.LANCZOS)
    for _, uv_start, values in uvs.values():
        store(uv_start, [[(u * width - left) / (right - left), (v * height - top) / (bottom - top)]
                         for u, v in values], 2)
    encoded_image = io.BytesIO()
    crop.save(encoded_image, 'JPEG', quality=JPEG_QUALITY, optimize=True)

    # Drop the merged body's accessors and views, which nothing references after the split.
    kept_accessors = sorted({a for primitive in every_primitive
                             for a in [*primitive['attributes'].values(), primitive['indices']]})
    accessor_ids = {old: new for new, old in enumerate(kept_accessors)}
    for primitive in every_primitive:
        primitive['attributes'] = {name: accessor_ids[a] for name, a in primitive['attributes'].items()}
        primitive['indices'] = accessor_ids[primitive['indices']]
    document['accessors'] = [document['accessors'][a] for a in kept_accessors]
    kept_views = sorted({accessor['bufferView'] for accessor in document['accessors']} | {image_def['bufferView']})
    view_ids = {old: new for new, old in enumerate(kept_views)}
    for accessor in document['accessors']:
        accessor['bufferView'] = view_ids[accessor['bufferView']]

    # Repack the kept views in order, swapping in the cropped image.
    packed, views = bytearray(), []
    for view_id in kept_views:
        view = document['bufferViews'][view_id]
        if view_id == image_def['bufferView']:
            raw = encoded_image.getvalue()
        else:
            view_start, view_end = view_slice(view_id)
            raw = bytes(binary[view_start:view_end])
        packed.extend(b'\x00' * (-len(packed) % 4))
        views.append({**view, 'byteOffset': len(packed), 'byteLength': len(raw)})
        packed.extend(raw)
    packed.extend(b'\x00' * (-len(packed) % 4))
    document['bufferViews'] = views
    image_def['bufferView'] = view_ids[image_def['bufferView']]
    document['buffers'] = [{'byteLength': len(packed)}]
    image_def['name'] = 'remora_brachyptera'
    image_def['mimeType'] = 'image/jpeg'
    # The photo's alpha is solid: opaque rendering avoids transparency sorting. Two-sided fins,
    # normals, UV layout and topology are kept as supplied.
    document['materials'][0].pop('alphaMode', None)
    document['materials'][0]['name'] = 'remora_brachyptera'

    encoded = json.dumps(document, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    output = struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(packed))
    output += struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
    output += struct.pack('<II', len(packed), 0x004E4942) + packed
    destination = ROOT / 'public/models/fish/remora-brachyptera/remora-brachyptera.glb'
    destination.write_bytes(output)
    print(json.dumps({'path': str(destination), 'textureCrop': [left, top, right, bottom],
                      'textureSize': list(crop.size), 'textureBytes': len(encoded_image.getvalue()),
                      'sourceSHA256': SOURCE_SHA256, 'bytes': len(output)}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    prepare(parser.parse_args().source)
