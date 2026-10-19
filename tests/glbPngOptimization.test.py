"""Run with python3 tests/glbPngOptimization.test.py (Pillow required)."""
import copy
import importlib.util
import io
from pathlib import Path
import unittest
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
        with self.assertRaisesRegex(AssertionError, 'Non-PNG'):
            glb_png.verify(self.before, glb_png.encode_glb(document, b'\xff' + binary[1:]))
        changed = copy.deepcopy(document)
        changed['samplers'][0]['minFilter'] = 9729
        with self.assertRaisesRegex(AssertionError, 'semantics'):
            glb_png.verify(self.before, glb_png.encode_glb(changed, binary))

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
            with self.subTest(kind=kind_to_change), self.assertRaises(AssertionError):
                glb_png.verify(self.before, glb_png.encode_glb(changed, binary[:start] + changed_png))


if __name__ == '__main__':
    unittest.main()
