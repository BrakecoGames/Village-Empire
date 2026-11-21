"""Testmodel: een kubus van 1×1×1 (één game-tegel), oorsprong onderaan in het midden.

Bouwen:  npm run models -- test_cube
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import bpy  # noqa: E402
import ve_blender as ve  # noqa: E402

args = ve.parse_args()
ve.reset_scene()

bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.5))
cube = bpy.context.active_object
cube.name = "TestCube"
ve.assign(cube, ve.material("Brick", ve.hex_color(0xC8643C)))
ve.flat(cube)
ve.origin_bottom_center(cube)

ve.export_glb(args.out, args.budget)
