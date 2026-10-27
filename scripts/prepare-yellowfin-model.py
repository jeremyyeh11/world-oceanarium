"""Centre Jeremy's inspected Yellowfin export; preserve UVs, normals and texture.

python scripts/prepare-yellowfin-model.py "path/to/thunnus albacares.glb"
Landmark indices are valid only for the hash below.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct

SOURCE_SHA256 = '6c17ab56fa15e3b140e461fe86db8aa300b586b78f6cffc5f56da3faf6c0aaaf'
ROOT = Path(__file__).resolve().parents[1]


def prepare(source):
    data = source.read_bytes()
    if hashlib.sha256(data).hexdigest() != SOURCE_SHA256:
        raise ValueError('Unrecognised export; inspect landmarks before changing this script')
    json_size = struct.unpack_from('<I', data, 12)[0]
    document = json.loads(data[20:20 + json_size])
    binary = bytearray(data[28 + json_size:])
    accessor = document['accessors'][0]
    view = document['bufferViews'][accessor['bufferView']]
    if accessor['componentType'] != 5126 or accessor['type'] != 'VEC3' or 'byteStride' in view:
        raise ValueError('Expected contiguous float32 positions')
    offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    positions = [struct.unpack_from('<3f', binary, offset + i * 12) for i in range(accessor['count'])]
    # Side-profile inspection: 8 is the mouth tip; 91 is the central notch of
    # the caudal trailing edge. The extended upper/lower tail tips are excluded.
    nose, fork = positions[8], positions[91]
    fork_length = fork[2] - nose[2]
    centre = [(nose[axis] + fork[axis]) / 2 for axis in range(3)]
    node = document['nodes'][0]
    translation = node.pop('translation', [0, 0, 0])
    world_centre = [centre[axis] + translation[axis] for axis in range(3)]
    node['name'] = 'thunnus_albacares'
    document['meshes'][0]['name'] = 'thunnus_albacares'
    for i, position in enumerate(positions):
        struct.pack_into('<3f', binary, offset + i * 12,
                         *(position[axis] + translation[axis] - world_centre[axis] for axis in range(3)))
    stored = [struct.unpack_from('<3f', binary, offset + i * 12) for i in range(accessor['count'])]
    accessor['min'] = [min(p[axis] for p in stored) for axis in range(3)]
    accessor['max'] = [max(p[axis] for p in stored) for axis in range(3)]
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
