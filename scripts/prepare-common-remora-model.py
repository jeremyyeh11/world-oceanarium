"""Turn Jeremy's inspected Common Remora export right side out and cut its photos down to the fish.

uv run --with pillow python scripts/prepare-common-remora-model.py "path/to/remora remora.glb"
Checks are valid only for the hash below.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import struct

from PIL import Image

SOURCE_SHA256 = 'd24edaecd27b57ebf72ae81524b4c884da3d233202c7395c2194489e8ff8ea98'
ROOT = Path(__file__).resolve().parents[1]
# Two photos (src/data/sources.js credits both): the body is Jeremy's recolour of a preserved
# FishBase specimen (1733 x 907), the disc a FishBase/Commons close-up of one (1592 x 988).
# Each primitive's UVs use only part of its photo; keep that rectangle plus a small margin,
# at most this wide.
CROP_MARGIN_PX = 8
MAX_TEXTURE_WIDTH = 1024
BODY_NAME = 'remora_remora'
IMAGE_NAMES = ['remora_remora_body', 'remora_remora_disc']


def prepare(source):
    data = source.read_bytes()
    if hashlib.sha256(data).hexdigest() != SOURCE_SHA256:
        raise ValueError('Unrecognised export; inspect it before changing this script')
    json_size = struct.unpack_from('<I', data, 12)[0]
    document = json.loads(data[20:20 + json_size])
    binary = bytearray(data[28 + json_size:])
    expected_names = {'remora remora', 'pectoral.l', 'pectoral.r', 'pelvic.l', 'pelvic.r'}
    if {node['name'] for node in document['nodes']} != expected_names:
        raise ValueError('Expected body and all four independent fins')

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

    # Inspection: every part (body, disc, fins) has its winding and normals consistently
    # pointing into the mesh (3% of the body's faces outward, the disc's top normals facing
    # down). Reverse each triangle and negate each normal. Flat shading is kept as supplied.
    flipped_indices = set()
    for mesh in document['meshes']:
        for primitive in mesh['primitives']:
            accessor_id = primitive['indices']
            if accessor_id in flipped_indices:
                continue
            flipped_indices.add(accessor_id)
            accessor = document['accessors'][accessor_id]
            code = {5121: 'B', 5123: 'H', 5125: 'I'}[accessor['componentType']]
            size = struct.calcsize(code)
            start = view_slice(accessor['bufferView'])[0] + accessor.get('byteOffset', 0)
            for triangle in range(accessor['count'] // 3):
                first = start + (triangle * 3 + 1) * size
                second = first + size
                a = struct.unpack_from(f'<{code}', binary, first)[0]
                b = struct.unpack_from(f'<{code}', binary, second)[0]
                struct.pack_into(f'<{code}', binary, first, b)
                struct.pack_into(f'<{code}', binary, second, a)
    flipped_normals = {primitive['attributes']['NORMAL'] for mesh in document['meshes'] for primitive in mesh['primitives']}
    for accessor_id in flipped_normals:
        _, start, values = floats(accessor_id, 3)
        store(start, [[-component for component in value] for value in values], 3)

    for node in document['nodes']:
        if node['name'] == 'remora remora':
            node['name'] = BODY_NAME
        document['meshes'][node['mesh']]['name'] = node['name']

    # Crop each photo to the UVs that sample it.
    uv_by_image = {}
    for mesh in document['meshes']:
        for primitive in mesh['primitives']:
            texture = document['materials'][primitive['material']]['pbrMetallicRoughness']['baseColorTexture']['index']
            image_id = document['textures'][texture]['source']
            uv_by_image.setdefault(image_id, set()).add(primitive['attributes']['TEXCOORD_0'])
    replaced = {}
    for image_id, uv_accessors in sorted(uv_by_image.items()):
        image_def = document['images'][image_id]
        start, end = view_slice(image_def['bufferView'])
        photo = Image.open(io.BytesIO(bytes(binary[start:end]))).convert('RGB')
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
        crop.save(encoded_image, 'PNG', optimize=True)
        replaced[image_def['bufferView']] = encoded_image.getvalue()
        image_def['name'] = IMAGE_NAMES[image_id]
        replaced[f'report-{image_id}'] = {'crop': [left, top, right, bottom], 'size': list(crop.size),
                                          'bytes': len(encoded_image.getvalue())}

    # Repack every view in order, swapping in the cropped images.
    packed, views = bytearray(), []
    for view_id, view in enumerate(document['bufferViews']):
        if view_id in replaced:
            raw = replaced[view_id]
        else:
            view_start, view_end = view_slice(view_id)
            raw = bytes(binary[view_start:view_end])
        packed.extend(b'\x00' * (-len(packed) % 4))
        views.append({**view, 'byteOffset': len(packed), 'byteLength': len(raw)})
        packed.extend(raw)
    packed.extend(b'\x00' * (-len(packed) % 4))
    document['bufferViews'] = views
    document['buffers'] = [{'byteLength': len(packed)}]
    # Both photos are opaque RGB: opaque rendering avoids transparency sorting (BLEND drew the
    # far side over the near on earlier fish). Two-sided fins and the UV layout are kept.
    for material, name in zip(document['materials'], IMAGE_NAMES):
        material.pop('alphaMode', None)
        material['name'] = name

    encoded = json.dumps(document, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    output = struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(packed))
    output += struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
    output += struct.pack('<II', len(packed), 0x004E4942) + packed
    destination = ROOT / 'public/models/fish/remora-remora/remora-remora.glb'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(output)
    print(json.dumps({'path': str(destination), 'textures': [replaced[key] for key in replaced if str(key).startswith('report-')],
                      'sourceSHA256': SOURCE_SHA256, 'bytes': len(output)}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    prepare(parser.parse_args().source)
