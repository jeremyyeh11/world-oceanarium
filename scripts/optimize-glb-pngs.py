#!/usr/bin/env python3
"""Recompress embedded PNGs without changing their format, metadata or filtered rows.

Apply: env -u PYTHONPATH uv run --python 3.12 --with zopfli --with pillow python scripts/optimize-glb-pngs.py --apply
Verify against git: python3 scripts/optimize-glb-pngs.py --compare-ref origin/main
Verification needs Pillow; optimization optionally uses zopfli for better DEFLATE.
No resizing, requantization, colour conversion, image externalization or geometry changes.
"""
import argparse
import copy
import hashlib
import importlib
import io
import json
from pathlib import Path
import struct
import subprocess
import zlib

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PNG = b'\x89PNG\r\n\x1a\n'


def chunks(data):
    assert data.startswith(PNG), 'Not a PNG'
    pos = 8
    result = []
    while pos < len(data):
        size = struct.unpack_from('>I', data, pos)[0]
        end = pos + 12 + size
        assert end <= len(data), 'Truncated PNG chunk'
        kind, payload = data[pos + 4:pos + 8], data[pos + 8:pos + 8 + size]
        assert zlib.crc32(kind + payload) == struct.unpack_from('>I', data, end - 4)[0]
        result.append((kind, payload))
        pos = end
    assert result[-1][0] == b'IEND'
    return result


def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))


def filtered_rows(data):
    return zlib.decompress(b''.join(payload for kind, payload in chunks(data) if kind == b'IDAT'))


def recompress(data):
    # Preserve the IHDR and every non-IDAT chunk byte-for-byte, including ICC,
    # gamma, chromaticity, EXIF and provenance. Recompress only the same filtered
    # scanlines, so even bit depth, colour type and invisible RGB stay unchanged.
    original = chunks(data)
    raw = filtered_rows(data)
    candidates = [zlib.compress(raw, level=9)]
    try:
        zopfli_zlib = importlib.import_module('zopfli.zlib')
        candidates.append(zopfli_zlib.compress(raw, numiterations=5))
    except ImportError:
        pass
    encoded = min(candidates, key=len)
    result = [PNG]
    inserted = False
    for kind, payload in original:
        if kind == b'IDAT':
            if not inserted:
                result.append(chunk(kind, encoded))
                inserted = True
        else:
            result.append(chunk(kind, payload))
    optimized = b''.join(result)
    assert filtered_rows(optimized) == raw
    return optimized if len(optimized) < len(data) else data


def parse_glb(data):
    magic, version, length = struct.unpack_from('<III', data)
    assert (magic, version, length) == (0x46546C67, 2, len(data))
    size, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4E4F534A
    document = json.loads(data[20:20 + size])
    offset = 20 + size
    size, kind = struct.unpack_from('<II', data, offset)
    assert kind == 0x004E4942 and offset + 8 + size == len(data), 'Expected JSON + BIN only'
    assert len(document['buffers']) == 1 and 'uri' not in document['buffers'][0]
    return document, data[offset + 8:offset + 8 + size]


def view_bytes(document, binary, index):
    view = document['bufferViews'][index]
    start = view.get('byteOffset', 0)
    return binary[start:start + view['byteLength']]


def encode_glb(document, binary):
    text = json.dumps(document, separators=(',', ':'), ensure_ascii=False).encode()
    text += b' ' * (-len(text) % 4)
    binary += b'\0' * (-len(binary) % 4)
    return (struct.pack('<III', 0x46546C67, 2, 28 + len(text) + len(binary))
            + struct.pack('<II', len(text), 0x4E4F534A) + text
            + struct.pack('<II', len(binary), 0x004E4942) + binary)


def optimize_glb(data, cache):
    document, binary = parse_glb(data)
    png_views = {image['bufferView'] for image in document.get('images', [])
                 if image.get('mimeType') == 'image/png' and 'bufferView' in image}
    if not png_views:
        return data
    result = copy.deepcopy(document)
    parts, cursor = [], 0
    for index, view in enumerate(document['bufferViews']):
        original = view_bytes(document, binary, index)
        content = original
        if index in png_views:
            digest = hashlib.sha256(original).digest()
            if digest not in cache:
                cache[digest] = recompress(original)
            content = cache[digest]
        parts.append(b'\0' * (-cursor % 4))
        cursor += -cursor % 4
        result['bufferViews'][index]['byteOffset'] = cursor
        result['bufferViews'][index]['byteLength'] = len(content)
        parts.append(content)
        cursor += len(content)
    result['buffers'][0]['byteLength'] = cursor
    optimized = encode_glb(result, b''.join(parts))
    verify(data, optimized)
    return optimized if len(optimized) < len(data) else data


def verify(before, after):
    old, old_bin = parse_glb(before)
    new, new_bin = parse_glb(after)
    old_semantics, new_semantics = copy.deepcopy(old), copy.deepcopy(new)
    old_semantics['buffers'][0].pop('byteLength')
    new_semantics['buffers'][0].pop('byteLength')
    png_views = {image['bufferView'] for image in old.get('images', [])
                 if image.get('mimeType') == 'image/png' and 'bufferView' in image}
    assert len(old['bufferViews']) == len(new['bufferViews'])
    for index in range(len(old['bufferViews'])):
        for semantics in [old_semantics, new_semantics]:
            semantics['bufferViews'][index].pop('byteOffset', None)
            if index in png_views:
                semantics['bufferViews'][index].pop('byteLength')
        a, b = view_bytes(old, old_bin, index), view_bytes(new, new_bin, index)
        if index in png_views:
            assert [(k, v) for k, v in chunks(a) if k != b'IDAT'] == [(k, v) for k, v in chunks(b) if k != b'IDAT'], 'PNG format/metadata changed'
            assert filtered_rows(a) == filtered_rows(b), 'Filtered PNG rows changed'
            with Image.open(io.BytesIO(a)) as ia, Image.open(io.BytesIO(b)) as ib:
                assert ia.size == ib.size and ia.mode == ib.mode
                assert ia.tobytes() == ib.tobytes(), 'Decoded pixels changed'
        else:
            assert a == b, f'Non-PNG bufferView {index} changed'
    assert old_semantics == new_semantics, 'GLB semantics changed'
    return len(png_views)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--apply', action='store_true')
    group.add_argument('--compare-ref')
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    paths = sorted((ROOT / 'public/models').rglob('*.glb'))
    results, cache = [], {}
    for path in paths:
        relative = path.relative_to(ROOT).as_posix()
        current = path.read_bytes()
        if args.compare_ref:
            before = subprocess.check_output(['git', 'show', f'{args.compare_ref}:{relative}'], cwd=ROOT)
            after = current
        else:
            before, after = current, optimize_glb(current, cache)
        if before == after:
            continue
        count = verify(before, after)
        if args.apply:
            path.write_bytes(after)
        record = {'path': relative, 'before': len(before), 'after': len(after),
                  'saved': len(before) - len(after), 'pngs_verified': count,
                  'sha256': hashlib.sha256(after).hexdigest()}
        results.append(record)
        print(json.dumps(record), flush=True)
    summary = {'files': results, 'count': len(results), 'saved_bytes': sum(row['saved'] for row in results),
               'verification': 'identical filtered PNG rows, decoded pixels, format/metadata; identical non-PNG bufferViews and GLB semantics'}
    if args.report:
        args.report.write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps({'count': summary['count'], 'saved_bytes': summary['saved_bytes']}))


if __name__ == '__main__':
    main()
