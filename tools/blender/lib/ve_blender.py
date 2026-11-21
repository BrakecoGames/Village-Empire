"""Village Empire — gedeelde Blender-helpers voor het genereren van game-modellen.

Wordt geïmporteerd door de scripts in tools/blender/models/. Draait binnen Blender
(bpy beschikbaar), aangeroepen via build.mjs:

    blender --background --factory-startup --python <model.py> -- --out <pad.glb>

Richtlijnen voor CrazyGames / HTML5:
  * low-poly, flat shading, kleuren via materialen (geen textures nodig)
  * 1 Blender-eenheid = 1 game-tegel; oorsprong onderaan in het midden
  * houd een model onder het driehoeksbudget (standaard 3000)
"""
import sys
import argparse
import bpy
import bmesh

DEFAULT_TRI_BUDGET = 3000


# ---------------------------------------------------------------- argumenten
def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True, help="pad naar het .glb-uitvoerbestand")
    p.add_argument("--budget", type=int, default=DEFAULT_TRI_BUDGET, help="max. aantal driehoeken")
    return p.parse_args(argv)


# ---------------------------------------------------------------- scène
def reset_scene():
    """Lege scène, metrische eenheden."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.unit_settings.system = "METRIC"
    s.unit_settings.scale_length = 1.0


_mat_cache = {}


def material(name, color, roughness=0.85, metallic=0.0, emission=None):
    """Eenvoudig PBR-materiaal; exporteert naar glTF als baseColorFactor (geen texture)."""
    key = (name, tuple(color), roughness, metallic, emission)
    if key in _mat_cache:
        return _mat_cache[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    rgba = tuple(color) + ((1.0,) if len(color) == 3 else ())
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = tuple(emission) + (1.0,)
        bsdf.inputs["Emission Strength"].default_value = 1.0
    m.diffuse_color = rgba
    _mat_cache[key] = m
    return m


def hex_color(h):
    """0xRRGGBB (sRGB) -> lineaire RGB-tuple, zodat kleuren in Three.js kloppen."""
    def lin(c):
        c /= 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin((h >> 16) & 255), lin((h >> 8) & 255), lin(h & 255))


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


def flat(obj):
    """Flat shading (low-poly look)."""
    for poly in obj.data.polygons:
        poly.use_smooth = False
    return obj


def join(objs, name):
    """Voegt objecten samen tot één mesh (= één draw call per materiaal in Three.js)."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    return o


def origin_bottom_center(obj):
    """Zet de oorsprong onderaan in het midden van de bounding box en het object op (0,0,0)."""
    bpy.context.view_layer.update()
    xs = [v.co.x for v in obj.data.vertices]
    ys = [v.co.y for v in obj.data.vertices]
    zs = [v.co.z for v in obj.data.vertices]
    off = ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs))
    for v in obj.data.vertices:
        v.co.x -= off[0]; v.co.y -= off[1]; v.co.z -= off[2]
    obj.location = (0, 0, 0)
    return obj


def apply_transforms(objs=None):
    objs = objs or [o for o in bpy.context.scene.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


# ---------------------------------------------------------------- statistiek
def triangle_count(objs=None):
    objs = objs or [o for o in bpy.context.scene.objects if o.type == "MESH"]
    dg = bpy.context.evaluated_depsgraph_get()
    total = 0
    for o in objs:
        me = o.evaluated_get(dg).to_mesh()
        bm = bmesh.new(); bm.from_mesh(me)
        total += sum(len(f.verts) - 2 for f in bm.faces)
        bm.free()
        o.evaluated_get(dg).to_mesh_clear()
    return total


# ---------------------------------------------------------------- export
def export_glb(path, budget=DEFAULT_TRI_BUDGET):
    """Exporteert alle meshes als .glb, geschikt voor Three.js r128 (GLTFLoader, zonder Draco)."""
    import os
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        raise SystemExit("VE-BLENDER: geen meshes om te exporteren")
    tris = triangle_count(meshes)
    if tris > budget:
        raise SystemExit(f"VE-BLENDER: {tris} driehoeken > budget {budget}; vereenvoudig het model of verhoog --budget")
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=False,
        export_apply=True,            # modifiers toepassen
        export_yup=True,              # Three.js is Y-up
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_texcoords=False,       # geen textures -> geen UV's nodig (kleiner bestand)
        export_normals=True,
        export_materials="EXPORT",
        export_animations=False,
        export_draco_mesh_compression_enable=False,  # r128 zonder DRACOLoader
    )
    size = os.path.getsize(path)
    print(f"VE-BLENDER-OK {path} tris={tris} bytes={size}")
    return tris, size
