"""Run with python3 tests/glbPngOptimization.test.py (Pillow required)."""
import copy
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zlib

from PIL import Image

spec = importlib.util.spec_from_file_location('glb_png', Path(__file__).resolve().parents[1] / 'scripts/optimize-glb-pngs.py')
assert spec is not None and spec.loader is not None
glb_png = importlib.util.module_from_spec(spec)
spec.loader.exec_module(glb_png)


def fixture():
    image = Image.new('RGBA', (32, 32), (14, 71, 119, 0))
    out = io.BytesIO()
    image.save(out, format='PNG', compress_level=0)
    original = out.getvalue()
    # A real ancillary chunk must survive, not just decoded visible pixels.
    png = original[:-12] + glb_png.chunk(b'tEXt', b'Credit\0Original Artist') + original[-12:]
    geometry = b'\x01\x02\x03\x04' * 12
    document = {
        'asset': {'version': '2.0'},
        'buffers': [{'byteLength': len(geometry) + len(png)}],
        'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': len(geometry), 'target': 34962},
                        {'buffer': 0, 'byteOffset': len(geometry), 'byteLength': len(png)}],
        'images': [{'bufferView': 1, 'mimeType': 'image/png'}],
        'textures': [{'source': 0, 'sampler': 0}],
        'samplers': [{'minFilter': 9987, 'wrapS': 10497}],
        'materials': [{'alphaMode': 'BLEND', 'doubleSided': True}],
    }
    return glb_png.encode_glb(document, geometry + png)


class OptimizationTest(unittest.TestCase):
    def setUp(self):
        self.before = fixture()
        self.after = glb_png.optimize_glb(self.before, {})

    def test_smaller_and_identical(self):
        self.assertLess(len(self.after), len(self.before))
        self.assertEqual(glb_png.verify(self.before, self.after), 1)
        self.assertEqual(glb_png.optimize_glb(self.after, {}), self.after)

    def test_rejects_geometry_or_sampler_change(self):
        document, binary = glb_png.parse_glb(self.after)
        with self.assertRaisesRegex(ValueError, 'Non-PNG'):
            glb_png.verify(self.before, glb_png.encode_glb(document, b'\xff' + binary[1:]))
        changed = copy.deepcopy(document)
        changed['samplers'][0]['minFilter'] = 9729
        with self.assertRaisesRegex(ValueError, 'semantics'):
            glb_png.verify(self.before, glb_png.encode_glb(changed, binary))

    def test_rejects_boolean_number_semantic_substitution(self):
        document, binary = glb_png.parse_glb(self.after)
        for collection, key, value in [('textures', 'source', False), ('materials', 'doubleSided', 1)]:
            changed = copy.deepcopy(document)
            changed[collection][0][key] = value
            with self.subTest(collection=collection), self.assertRaisesRegex(ValueError, 'semantics'):
                glb_png.verify(self.after, glb_png.encode_glb(changed, binary))

    def test_rejects_format_metadata_or_pixels_change(self):
        document, binary = glb_png.parse_glb(self.after)
        png = glb_png.view_bytes(document, binary, 1)
        for kind_to_change in [b'tEXt', b'IDAT', b'IHDR']:
            changed_chunks = []
            for kind, payload in glb_png.chunks(png):
                if kind == kind_to_change:
                    if kind == b'IDAT':
                        rows = zlib.decompress(payload)
                        payload = zlib.compress(rows[:-1] + bytes([rows[-1] ^ 1]))
                    else:
                        payload = payload[:-1] + bytes([payload[-1] ^ 1])
                changed_chunks.append(glb_png.chunk(kind, payload))
            changed_png = glb_png.PNG + b''.join(changed_chunks)
            changed = copy.deepcopy(document)
            start = changed['bufferViews'][1]['byteOffset']
            changed['bufferViews'][1]['byteLength'] = len(changed_png)
            changed['buffers'][0]['byteLength'] = start + len(changed_png)
            with self.subTest(kind=kind_to_change), self.assertRaises(ValueError):
                glb_png.verify(self.before, glb_png.encode_glb(changed, binary[:start] + changed_png))

    def test_rejects_extension_owned_ranges(self):
        document, binary = glb_png.parse_glb(self.before)
        document['extensionsUsed'] = ['EXT_meshopt_compression']
        document['bufferViews'][0]['extensions'] = {
            'EXT_meshopt_compression': {'buffer': 0, 'byteOffset': len(binary),
                                       'byteLength': 4, 'byteStride': 4,
                                       'count': 1, 'mode': 'ATTRIBUTES'},
        }
        document['buffers'][0]['byteLength'] = len(binary) + 4
        encoded = glb_png.encode_glb(document, binary + b'\x11\x22\x33\x44')
        with self.assertRaisesRegex(ValueError, 'extension'):
            glb_png.optimize_glb(encoded, {})
        with self.assertRaisesRegex(ValueError, 'extension'):
            glb_png.verify(encoded, encoded)
        del document['extensionsUsed']
        with self.assertRaisesRegex(ValueError, 'extension'):
            glb_png.optimize_glb(glb_png.encode_glb(document, binary + b'\x11\x22\x33\x44'), {})

    def test_rejects_invalid_view_ranges(self):
        document, binary = glb_png.parse_glb(self.before)
        for key, value in [('byteOffset', 1), ('byteOffset', -4),
                           ('byteLength', len(binary) + 1), ('buffer', 1), ('buffer', False), ('buffer', 0.0)]:
            changed = copy.deepcopy(document)
            changed['bufferViews'][0][key] = value
            with self.subTest(key=key, value=value), self.assertRaisesRegex(ValueError, 'range'):
                glb_png.verify(self.before, glb_png.encode_glb(changed, binary))

    def test_rejects_invalid_declared_buffer_length(self):
        document, binary = glb_png.parse_glb(self.after)
        for length in [0, -1, len(binary) + 1, len(binary) - 4, 1.5, True]:
            changed = copy.deepcopy(document)
            changed['buffers'][0]['byteLength'] = length
            with self.subTest(length=length), self.assertRaisesRegex(ValueError, 'buffer'):
                glb_png.verify(self.after, glb_png.encode_glb(changed, binary))

    def test_verification_survives_python_optimized_mode(self):
        result = subprocess.run([
            sys.executable, '-O', __file__,
            'OptimizationTest.test_rejects_geometry_or_sampler_change',
            'OptimizationTest.test_rejects_format_metadata_or_pixels_change',
            'OptimizationTest.test_rejects_boolean_number_semantic_substitution',
            'OptimizationTest.test_rejects_invalid_view_ranges',
        ], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_comparison_reports_new_files_without_aborting_existing_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            models = root / 'public/models/fish'
            models.mkdir(parents=True)
            existing = models / 'existing.glb'
            existing.write_bytes(self.before)
            removed = models / 'removed.glb'
            removed.write_bytes(self.before)
            def git(*args):
                return subprocess.check_output(['git', *args], cwd=root, stderr=subprocess.PIPE)
            git('init', '--quiet')
            git('add', '.')
            git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'baseline')
            # New file sorts first: must not prevent checking the existing change.
            (models / 'added.glb').write_bytes(self.before)
            existing.write_bytes(self.after)

            report = root / 'report.json'
            with patch.object(glb_png, 'ROOT', root), patch.object(sys, 'argv', [
                'optimize-glb-pngs.py', '--compare-ref', 'HEAD', '--report', str(report),
            ]):
                glb_png.main()
            result = json.loads(report.read_text())
            self.assertEqual(result['count'], 1)
            self.assertEqual(result['files'][0]['path'], 'public/models/fish/existing.glb')
            self.assertEqual(result['added_files'][0]['path'], 'public/models/fish/added.glb')
            self.assertEqual(result['added_files'][0]['status'], 'no-baseline-not-equivalence-verified')
            self.assertEqual(result['removed_files'], [])

            removed.unlink()
            with patch.object(glb_png, 'ROOT', root), patch.object(sys, 'argv', [
                'optimize-glb-pngs.py', '--compare-ref', 'HEAD', '--report', str(report),
            ]), self.assertRaises(SystemExit) as error:
                glb_png.main()
            self.assertEqual(error.exception.code, 1)
            self.assertEqual(json.loads(report.read_text())['removed_files'], ['public/models/fish/removed.glb'])

            with patch.object(glb_png, 'ROOT', root), patch.object(sys, 'argv', [
                'optimize-glb-pngs.py', '--compare-ref', 'does-not-exist',
            ]), self.assertRaises(subprocess.CalledProcessError):
                glb_png.main()


if __name__ == '__main__':
    unittest.main()
