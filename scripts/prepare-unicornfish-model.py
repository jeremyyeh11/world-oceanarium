"""Centre Jeremy's 2026-10-27 GLB without re-exporting its geometry or texture.

python scripts/prepare-unicornfish-model.py "path/to/naso unicornis.glb"
Only this inspected export is accepted: landmark indices are asset-specific.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct

SOURCE_SHA256 = 'f7916e72b78ed2682b1ad7a990c4d9a147c5ed658a1c7b06aa0ff97c488bf1c9'
ROOT = Path(__file__).resolve().parents[1]


def prepare(source):
    data = source.read_bytes()
    if hashlib.sha256(data).hexdigest() != SOURCE_SHA256:
        raise ValueError('Unrecognised export; inspect its landmarks before updating this script')
    json_size = struct.unpack_from('<I', data, 12)[0]
    document = json.loads(data[20:20 + json_size])
    binary = bytearray(data[28 + json_size:])

    def positions(accessor_id):
        accessor = document['accessors'][accessor_id]
        view = document['bufferViews'][accessor['bufferView']]
        if accessor['componentType'] != 5126 or accessor['type'] != 'VEC3' or 'byteStride' in view:
            raise ValueError('Expected contiguous float positions')
        offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        values = [struct.unpack_from('<3f', binary, offset + index * 12) for index in range(accessor['count'])]
        return accessor, offset, values

    _, _, body = positions(0)
    # Mouth tip 106; the two central rear-rim vertices 150/250 bracket the
    # middle caudal rays. Their midpoint is the fork reference, not either tip.
    nose_z = body[106][2]
    fork_z = (body[150][2] + body[250][2]) / 2
    fork_length = fork_z - nose_z
    translation = document['nodes'][0]['translation']
    centre = [body[106][0] + translation[0], 2.0, (nose_z + fork_z) / 2 + translation[2]]
    for node in document['nodes']:
        shift = node.pop('translation', [0, 0, 0])
        if node['mesh'] == 0:
            node['name'] = 'naso_unicornis'
        for primitive in document['meshes'][node['mesh']]['primitives']:
            accessor, offset, values = positions(primitive['attributes']['POSITION'])
            shifted = [[value[axis] + shift[axis] - centre[axis] for axis in range(3)] for value in values]
            for index, value in enumerate(shifted):
                struct.pack_into('<3f', binary, offset + index * 12, *value)
            # Bounds must describe the stored float32 values, not Python's intermediate doubles.
            _, _, stored = positions(primitive['attributes']['POSITION'])
            accessor['min'] = [min(value[axis] for value in stored) for axis in range(3)]
            accessor['max'] = [max(value[axis] for value in stored) for axis in range(3)]
    # All alpha samples are 255. Opaque rendering avoids transparency sorting;
    # the embedded PNG, UVs, topology, normals and two-sided fin material are retained.
    document['materials'][0].pop('alphaMode', None)
    encoded = json.dumps(document, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    output = struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(binary))
    output += struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
    output += struct.pack('<II', len(binary), 0x004E4942) + binary
    destination = ROOT / 'public/models/fish/naso-unicornis/naso-unicornis.glb'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(output)
    print(json.dumps({'path': str(destination), 'sourceForkLength': fork_length,
                      'scaleAt70cmFL': 2.8 / fork_length, 'bakedCentre': centre,
                      'sourceSHA256': SOURCE_SHA256, 'bytes': len(output)}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    prepare(parser.parse_args().source)
