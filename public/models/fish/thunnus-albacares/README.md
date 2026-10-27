# Yellowfin Tuna source

Jeremy supplied `thunnus albacares.glb` on 2026-10-27 from his Blender model folder.
Source SHA-256: `f48dcfa4d22611f6f801e1556c71e1397b18304bcc7ae3bfc09bea2f127de3b8`.
The embedded texture is the photo Jeremy selected for texture use:
https://jp.pinterest.com/pin/451274825163264242/ . Original photographer/licence is
not established by the supplied Pinterest link; no additional licensing claim is made.

`scripts/prepare-yellowfin-model.py` reproduces the runtime copy. It centres the
mouth/fork midpoint and bakes all five node offsets into one shared frame. All
parts use the same material, so their vertex streams are joined into one primitive
named `thunnus_albacares` for the 299-fish school's draw budget. No geometry is
removed: UVs, normals, triangles and embedded image bytes are retained. The paired
stabilising fins hold their supplied pose on the rigid front. Original untouched.
BLEND is removed because every PNG alpha sample is 255; double-sided fins remain.

Source: body 3,202 vertices / 1,668 triangles, four fins each 96 / 48. Runtime:
one mesh, **3,586 vertices / 1,860 triangles**. No clips, skins or colours.
Source-part names and vertex/index ranges survive in mesh extras; the intake hash
guard and verifier require all four paired fins, so the earlier incomplete export
cannot pass intake. Source names: `pectoral.l/r`, `pelvic.l/r`.

Nose -Z, Y up. Mouth vertex 8 Z=-0.500812769; central fork vertex 91 Z=1.739716649
in the source body. Fork length 2.240529418; full tip span 2.398549914. Maximum
239 cm FL / 9.56 WU gives `model.scale=4.266848684615521`. Atlas uses the same
fork measurement. Dorsals, anal fin, finlets and tail follow the shared body wave.
