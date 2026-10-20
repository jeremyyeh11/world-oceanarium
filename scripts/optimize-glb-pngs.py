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


def require(condition, message):
    # Validation must survive python -O/PYTHONOPTIMIZE; assert is not a gate.
    if not condition:
        raise ValueError(message)


def chunks(data):
    require(data.startswith(PNG), 'Not a PNG')
    pos = 8
    result = []
    while pos < len(data):
        require(pos + 12 <= len(data), 'Truncated PNG chunk header')
        size = struct.unpack_from('>I', data, pos)[0]
        end = pos + 12 + size
        require(end <= len(data), 'Truncated PNG chunk')
        kind, payload = data[pos + 4:pos + 8], data[pos + 8:pos + 8 + size]
        require(zlib.crc32(kind + payload) == struct.unpack_from('>I', data, end - 4)[0], 'PNG CRC mismatch')
        result.append((kind, payload))
        pos = end
    require(bool(result) and result[-1][0] == b'IEND', 'PNG is missing IEND')
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
    require(filtered_rows(optimized) == raw, 'Recompression changed filtered PNG rows')
    return optimized if len(optimized) < len(data) else data


def reject_extensions(document):
    # Unknown extensions may own independent BIN ranges (e.g. meshopt), not just
    # top-level bufferViews. Refuse them in BOTH the repacker and verifier rather
    # than copying JSON that can silently point at moved/discarded source bytes.
    names = set(document.get('extensionsUsed', [])) | set(document.get('extensionsRequired', []))
    def visit(value):
        if isinstance(value, dict):
            names.update(value.get('extensions', {}))
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)
    visit(document)
    if names:
        raise ValueError(f'GLB extensions are unsupported; refusing to repack or verify: {sorted(names)}')


def parse_glb(data):
    require(len(data) >= 28, 'Truncated GLB header')
    magic, version, length = struct.unpack_from('<III', data)
    require((magic, version, length) == (0x46546C67, 2, len(data)), 'Invalid GLB header')
    size, kind = struct.unpack_from('<II', data, 12)
    require(kind == 0x4E4F534A and size % 4 == 0 and 28 + size <= len(data), 'Invalid GLB JSON chunk')
    document = json.loads(data[20:20 + size])
    reject_extensions(document)
    offset = 20 + size
    size, kind = struct.unpack_from('<II', data, offset)
    require(kind == 0x004E4942 and size % 4 == 0 and offset + 8 + size == len(data), 'Expected JSON + BIN only')
    require(len(document['buffers']) == 1 and 'uri' not in document['buffers'][0], 'Expected one embedded buffer')
    buffer_length = document['buffers'][0]['byteLength']
    if type(buffer_length) is not int or buffer_length < 0 or not 0 <= size - buffer_length <= 3:
        raise ValueError('GLB buffer length does not match BIN data (apart from padding)')
    for view in document.get('bufferViews', []):
        start, length = view.get('byteOffset', 0), view['byteLength']
        if (view.get('buffer', 0) != 0 or type(start) is not int or type(length) is not int
                or start < 0 or start % 4 or length <= 0 or start + length > buffer_length):
            raise ValueError('GLB bufferView has an invalid buffer/range/alignment')
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
    require(len(old['bufferViews']) == len(new['bufferViews']), 'GLB bufferView count changed')
    for index in range(len(old['bufferViews'])):
        for semantics in [old_semantics, new_semantics]:
            semantics['bufferViews'][index].pop('byteOffset', None)
            if index in png_views:
                semantics['bufferViews'][index].pop('byteLength')
        a, b = view_bytes(old, old_bin, index), view_bytes(new, new_bin, index)
        if index in png_views:
            require([(k, v) for k, v in chunks(a) if k != b'IDAT'] == [(k, v) for k, v in chunks(b) if k != b'IDAT'], 'PNG format/metadata changed')
            require(filtered_rows(a) == filtered_rows(b), 'Filtered PNG rows changed')
            with Image.open(io.BytesIO(a)) as ia, Image.open(io.BytesIO(b)) as ib:
                require(ia.size == ib.size and ia.mode == ib.mode, 'PNG dimensions/mode changed')
                require(ia.tobytes() == ib.tobytes(), 'Decoded pixels changed')
        else:
            require(a == b, f'Non-PNG bufferView {index} changed')
    require(old_semantics == new_semantics, 'GLB semantics changed')
    return len(png_views)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--apply', action='store_true')
    group.add_argument('--compare-ref')
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    paths = sorted((ROOT / 'public/models').rglob('*.glb'))
    results, added_files, cache = [], [], {}
    baseline_paths = set()
    baseline_ref = None
    if args.compare_ref:
        # Resolve first: a bad ref must fail, never be mislabelled as all-new files.
        baseline_ref = subprocess.check_output(
            ['git', 'rev-parse', '--verify', '--end-of-options', f'{args.compare_ref}^{{commit}}'],
            cwd=ROOT, text=True,
        ).strip()
        baseline_paths = set(subprocess.check_output(
            ['git', 'ls-tree', '-r', '--name-only', '-z', baseline_ref, '--', 'public/models'],
            cwd=ROOT, text=True,
        ).split('\0'))
        baseline_paths = {path for path in baseline_paths if path.endswith('.glb')}
    current_paths = {path.relative_to(ROOT).as_posix() for path in paths}
    for path in paths:
        relative = path.relative_to(ROOT).as_posix()
        current = path.read_bytes()
        if args.compare_ref:
            if relative not in baseline_paths:
                verify(current, current)  # Structural/PNG checks only; not equivalence.
                record = {'path': relative, 'bytes': len(current),
                          'sha256': hashlib.sha256(current).hexdigest(),
                          'status': 'no-baseline-not-equivalence-verified'}
                added_files.append(record)
                print(json.dumps(record), flush=True)
                continue
            before = subprocess.check_output(['git', 'show', f'{baseline_ref}:{relative}'], cwd=ROOT)
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
    removed_files = sorted(baseline_paths - current_paths)
    summary = {'files': results, 'count': len(results), 'saved_bytes': sum(row['saved'] for row in results),
               'added_files': added_files, 'removed_files': removed_files,
               'comparison_ref': baseline_ref,
               'verification': 'identical filtered PNG rows, decoded pixels, format/metadata; identical non-PNG bufferViews and GLB semantics'}
    if args.report:
        args.report.write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps({'count': summary['count'], 'saved_bytes': summary['saved_bytes'],
                      'added_count': len(added_files), 'removed_count': len(removed_files)}))
    if removed_files:
        parser.exit(1, f'Lossless comparison failed: baseline GLBs were removed: {removed_files}\n')


if __name__ == '__main__':
    main()
