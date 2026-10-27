"""Centre Jeremy's inspected Yellowfin export; preserve UVs, normals and texture.

python scripts/prepare-yellowfin-model.py "path/to/thunnus albacares.glb"
Landmark indices are valid only for the hash below.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct

SOURCE_SHA256 = 'f48dcfa4d22611f6f801e1556c71e1397b18304bcc7ae3bfc09bea2f127de3b8'
ROOT = Path(__file__).resolve().parents[1]


def prepare(source):
    data = source.read_bytes()
    if hashlib.sha256(data).hexdigest() != SOURCE_SHA256:
        raise ValueError('Unrecognised export; inspect landmarks before changing this script')
    json_size = struct.unpack_from('<I', data, 12)[0]
    document = json.loads(data[20:20 + json_size])
    binary = bytearray(data[28 + json_size:])
    expected_names = {'thunnus albacares', 'pectoral.l', 'pectoral.r', 'pelvic.l', 'pelvic.r'}
    if {node['name'] for node in document['nodes']} != expected_names:
        raise ValueError('Expected body and all four independent fins')

    def positions(accessor_id):
        accessor = document['accessors'][accessor_id]
        view = document['bufferViews'][accessor['bufferView']]
        if accessor['componentType'] != 5126 or accessor['type'] != 'VEC3' or 'byteStride' in view:
            raise ValueError('Expected contiguous float32 positions')
        offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        values = [struct.unpack_from('<3f', binary, offset + i * 12) for i in range(accessor['count'])]
        return accessor, offset, values

    body_node = next(node for node in document['nodes'] if node['name'] == 'thunnus albacares')
    body_mesh = document['meshes'][body_node['mesh']]
    _, _, body = positions(body_mesh['primitives'][0]['attributes']['POSITION'])
    # Side-profile inspection: 8 is the mouth; 91 the caudal trailing-edge notch.
    nose, fork = body[8], body[91]
    fork_length = fork[2] - nose[2]
    translation = body_node.get('translation', [0, 0, 0])
    world_centre = [(nose[axis] + fork[axis]) / 2 + translation[axis] for axis in range(3)]
    body_node['name'] = body_mesh['name'] = 'thunnus_albacares'
    for node in document['nodes']:
        translation = node.pop('translation', [0, 0, 0])
        mesh = document['meshes'][node['mesh']]
        mesh['name'] = node['name']
        for primitive in mesh['primitives']:
            accessor, offset, values = positions(primitive['attributes']['POSITION'])
            for i, value in enumerate(values):
                struct.pack_into('<3f', binary, offset + i * 12,
                                 *(value[axis] + translation[axis] - world_centre[axis] for axis in range(3)))
            _, _, stored = positions(primitive['attributes']['POSITION'])
            accessor['min'] = [min(p[axis] for p in stored) for axis in range(3)]
            accessor['max'] = [max(p[axis] for p in stored) for axis in range(3)]
    # All five parts share one material. Join their vertex streams at intake so a
    # 299-fish school draws once per fish/pass, retaining every triangle and UV.
    # Paired fins are stabilisers, held in their supplied pose on the rigid front.
    def raw_accessor(accessor_id):
        accessor = document['accessors'][accessor_id]
        view = document['bufferViews'][accessor['bufferView']]
        if 'byteStride' in view:
            raise ValueError('Inspect interleaved attributes before merging')
        width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[accessor['type']]
        code = {5123: 'H', 5125: 'I', 5126: 'f'}[accessor['componentType']]
        offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        size = struct.calcsize('<' + code) * width * accessor['count']
        return accessor, bytes(binary[offset:offset + size]), code

    streams = {name: bytearray() for name in ['POSITION', 'NORMAL', 'TEXCOORD_0']}
    indices, parts, vertex_count = [], [], 0
    for node in document['nodes']:
        primitive, = document['meshes'][node['mesh']]['primitives']
        if primitive.get('material') != 0 or set(primitive['attributes']) != set(streams):
            raise ValueError('Expected identical material and position/normal/UV streams')
        count = document['accessors'][primitive['attributes']['POSITION']]['count']
        part = {'name': node['name'], 'vertexStart': vertex_count, 'vertexCount': count,
                'indexStart': len(indices)}
        for name in streams:
            accessor, raw, code = raw_accessor(primitive['attributes'][name])
            if code != 'f' or accessor['count'] != count:
                raise ValueError('Expected matching float32 vertex streams')
            streams[name].extend(raw)
        accessor, raw, code = raw_accessor(primitive['indices'])
        part['indexCount'] = accessor['count']
        indices.extend(index + vertex_count for index, in struct.iter_unpack('<' + code, raw))
        parts.append(part)
        vertex_count += count
    assert vertex_count == 3586 and len(indices) == 5580
    image_view = document['bufferViews'][document['images'][0]['bufferView']]
    start = image_view.get('byteOffset', 0)
    image = bytes(binary[start:start + image_view['byteLength']])
    binary, views, accessors = bytearray(), [], []

    def append_view(raw, target=None):
        binary.extend(b'\x00' * (-len(binary) % 4))
        view = {'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(raw)}
        if target is not None:
            view['target'] = target
        views.append(view)
        binary.extend(raw)
        return len(views) - 1

    for name, kind in [('POSITION', 'VEC3'), ('NORMAL', 'VEC3'), ('TEXCOORD_0', 'VEC2')]:
        accessor = {'bufferView': append_view(streams[name], 34962), 'componentType': 5126,
                    'count': vertex_count, 'type': kind}
        if name == 'POSITION':
            values = list(struct.iter_unpack('<3f', streams[name]))
            accessor['min'] = [min(v[a] for v in values) for a in range(3)]
            accessor['max'] = [max(v[a] for v in values) for a in range(3)]
        accessors.append(accessor)
    accessors.append({'bufferView': append_view(struct.pack('<' + 'H' * len(indices), *indices), 34963),
                      'componentType': 5123, 'count': len(indices), 'type': 'SCALAR'})
    document['images'][0]['bufferView'] = append_view(image)
    document['scenes'] = [{'nodes': [0]}]
    document['scene'] = 0
    document['nodes'] = [{'mesh': 0, 'name': 'thunnus_albacares'}]
    document['meshes'] = [{'name': 'thunnus_albacares', 'extras': {'sourceParts': parts},
                           'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2},
                                           'indices': 3, 'material': 0}]}]
    document['bufferViews'], document['accessors'] = views, accessors
    document['buffers'] = [{'byteLength': len(binary)}]
    binary.extend(b'\x00' * (-len(binary) % 4))
    # Inspection confirmed every embedded PNG alpha sample is 255. Keep the
    # original image bytes and two-sided fins; avoid transparent sorting.
    document['materials'][0].pop('alphaMode', None)
    encoded = json.dumps(document, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    output = struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(binary))
    output += struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
    output += struct.pack('<II', len(binary), 0x004E4942) + binary
    destination = ROOT / 'public/models/fish/thunnus-albacares/thunnus-albacares.glb'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(output)
    print(json.dumps({'path': str(destination), 'sourceForkLength': fork_length,
                      'scaleAt239cmFL': 9.56 / fork_length, 'bakedCentre': world_centre,
                      'sourceSHA256': SOURCE_SHA256, 'bytes': len(output)}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    prepare(parser.parse_args().source)
