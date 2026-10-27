# Yellowfin Tuna source

Jeremy supplied `thunnus albacares.glb` on 2026-10-27 from his Blender model folder.
Source SHA-256: `6c17ab56fa15e3b140e461fe86db8aa300b586b78f6cffc5f56da3faf6c0aaaf`.
The embedded texture is the photo Jeremy selected for texture use:
https://jp.pinterest.com/pin/451274825163264242/ . Original photographer/licence is
not established by the supplied Pinterest link; no additional licensing claim is made.

`scripts/prepare-yellowfin-model.py` reproduces the runtime copy. It centres the
mouth/fork midpoint, bakes the node offset, names the body `thunnus_albacares` and
removes BLEND because every PNG alpha sample is 255. UVs, normals, triangle indices,
embedded image bytes and double-sided fins are retained. Original source untouched.

Single mesh: 3,202 exported vertices, 1,668 triangles; no clips, skins or colours.
Nose -Z, Y up. Mouth vertex 8 Z=-0.500812769; central fork vertex 91 Z=1.739716649.
Fork length 2.240529418; full tail-tip span 2.398549914. Maximum 239 cm FL / 9.56 WU
gives `model.scale=4.266848684615521`. Atlas uses the same fork measurement.
All fins are joined; pectorals have no independent rowing in this intake.
