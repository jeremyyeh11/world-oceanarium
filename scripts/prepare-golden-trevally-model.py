"""Centre Jeremy's inspected Golden Trevally export and cut its photo down to the fish.

uv run --with pillow python scripts/prepare-golden-trevally-model.py "path/to/gnathanodon speciosus.glb"
Landmark values are valid only for the hash below.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import struct

from PIL import Image

SOURCE_SHA256 = '0fb6a16aaea75408b62af109978d0a1a4c69a31bb0059a63522c8fa17d286241'
ROOT = Path(__file__).resolve().parents[1]
# The texture is a 2048 x 1362 aquarium photo (Commons, CC BY-SA 3.0); the UVs use only
# the fish in its middle. Keep that rectangle plus a small margin, at most this wide.
CROP_MARGIN_PX = 8
MAX_TEXTURE_WIDTH = 1024


def prepare(source):
    data = source.read_bytes()
    if hashlib.sha256(data).hexdigest() != SOURCE_SHA256:
        raise ValueError('Unrecognised export; inspect landmarks before changing this script')
    json_size = struct.unpack_from('<I', data, 12)[0]
    document = json.loads(data[20:20 + json_size])
    binary = bytearray(data[28 + json_size:])
    expected_names = {'gnathanodon speciosus', 'pectoral.l', 'pectoral.r', 'pelvic.l', 'pelvic.r'}
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

    def store(accessor, start, values, width):
        for i, value in enumerate(values):
            struct.pack_into(f'<{width}f', binary, start + i * 4 * width, *value)

    body_node = next(node for node in document['nodes'] if node['name'] == 'gnathanodon speciosus')
    translation = body_node['translation']
    _, _, body = floats(document['meshes'][body_node['mesh']]['primitives'][0]['attributes']['POSITION'], 3)
    # Side-profile inspection: 104 is the mouth tip, 0 the lower caudal-lobe tip (the
    # farthest point back) and 117 the fork notch. Total length is mouth to lobe tip.
    nose, tail, fork = body[104], body[0], body[117]
    total_length = tail[2] - nose[2]
    # Root mid-length, on the line from mouth to fork notch: the body axis.
    centre = [0.0, (nose[1] + fork[1]) / 2 + translation[1], (nose[2] + tail[2]) / 2 + translation[2]]

    for node in document['nodes']:
        shift = node.pop('translation', [0, 0, 0])
        mesh = document['meshes'][node['mesh']]
        if node['name'] == 'gnathanodon speciosus':
            node['name'] = 'gnathanodon_speciosus'
        mesh['name'] = node['name']
        primitive, = mesh['primitives']
        accessor, start, values = floats(primitive['attributes']['POSITION'], 3)
        store(accessor, start, [[v[a] + shift[a] - centre[a] for a in range(3)] for v in values], 3)
        # Bounds must describe the stored float32 values, not Python's intermediate doubles.
        _, _, stored = floats(primitive['attributes']['POSITION'], 3)
        accessor['min'] = [min(p[a] for p in stored) for a in range(3)]
        accessor['max'] = [max(p[a] for p in stored) for a in range(3)]

    image_def = document['images'][0]
    start, end = view_slice(image_def['bufferView'])
    photo = Image.open(io.BytesIO(bytes(binary[start:end]))).convert('RGB')
    uv_accessors = sorted({mesh['primitives'][0]['attributes']['TEXCOORD_0'] for mesh in document['meshes']})
    if len(uv_accessors) != len(document['meshes']):
        raise ValueError('Expected one UV accessor per mesh')
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
    for accessor, uv_start, values in uvs.values():
        store(accessor, uv_start, [[(u * width - left) / (right - left), (v * height - top) / (bottom - top)]
                                   for u, v in values], 2)
    encoded_image = io.BytesIO()
    crop.save(encoded_image, 'PNG', optimize=True)

    # Repack every view in order, swapping in the cropped image.
    packed, views = bytearray(), []
    for view_id, view in enumerate(document['bufferViews']):
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
    document['buffers'] = [{'byteLength': len(packed)}]
    image_def['name'] = 'gnathanodon_speciosus'
    # The photo has no alpha channel: opaque rendering avoids transparency sorting.
    # Two-sided fins, normals, UV layout and topology are kept as supplied.
    document['materials'][0].pop('alphaMode', None)
    document['materials'][0]['name'] = 'gnathanodon_speciosus'

    encoded = json.dumps(document, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    output = struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(packed))
    output += struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
    output += struct.pack('<II', len(packed), 0x004E4942) + packed
    destination = ROOT / 'public/models/fish/gnathanodon-speciosus/gnathanodon-speciosus.glb'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(output)
    print(json.dumps({'path': str(destination), 'sourceTotalLength': total_length,
                      'sourceForkLength': fork[2] - nose[2], 'scaleAt120cmTL': 4.8 / total_length,
                      'bakedCentre': centre, 'textureCrop': [left, top, right, bottom],
                      'textureSize': list(crop.size), 'textureBytes': len(encoded_image.getvalue()),
                      'sourceSHA256': SOURCE_SHA256, 'bytes': len(output)}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    prepare(parser.parse_args().source)
