"""
Build the FORGE 6s vertical 3D intro scene in Blender.

Specs: 1080×1920 @ 60fps, frames 1–360, EEVEE-ready scene.
Run: blender --background --python marketing/blender/build_forge_intro.py
"""

from __future__ import annotations

import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Vector

# ---------------------------------------------------------------------------
# Paths / imports
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from materials import (  # noqa: E402
    CYAN,
    ORANGE,
    make_cyan_edge,
    make_emission,
    make_emissive_core,
    make_glass,
    make_metal_text,
    make_soft_text,
    set_world_color,
)

BLEND_PATH = SCRIPT_DIR / "forge_intro.blend"

# Timeline
FPS = 60
FRAME_START = 1
FRAME_END = 360
ACT1_END = 108
ACT2_END = 228
ACT3_END = 360

# Scene
RES_X = 1080
RES_Y = 1920
# Lean network for headless EEVEE (iGPU / Intel UHD)
NODE_COUNT = 10
RNG_SEED = 42


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for b in list(block):
            block.remove(b)
    for col in list(bpy.data.collections):
        if col.name != "Collection":
            bpy.data.collections.remove(col)


def ensure_collection(name: str) -> bpy.types.Collection:
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    return col


def link_to(obj: bpy.types.Object, col: bpy.types.Collection) -> None:
    # Unlink from scene root if present
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)


def set_ease_out_fcurves(obj: bpy.types.Object) -> None:
    if not obj.animation_data or not obj.animation_data.action:
        return
    action = obj.animation_data.action
    # Blender 5 may use layered actions; fall back to fcurves attribute
    fcurves = getattr(action, "fcurves", None)
    if fcurves is None and hasattr(action, "layers"):
        # Blender 5 slotted actions
        try:
            for layer in action.layers:
                for strip in layer.strips:
                    for channelbag in getattr(strip, "channelbags", []) or []:
                        for fc in channelbag.fcurves:
                            for kp in fc.keyframe_points:
                                kp.interpolation = "BEZIER"
                                kp.easing = "EASE_OUT"
            return
        except Exception:
            pass
        return
    for fc in fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
            kp.easing = "EASE_OUT"


def set_ease_inout_fcurves(obj: bpy.types.Object) -> None:
    if not obj.animation_data or not obj.animation_data.action:
        return
    action = obj.animation_data.action
    fcurves = getattr(action, "fcurves", None)
    if fcurves is None:
        return
    for fc in fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
            kp.easing = "EASE_IN_OUT"


def key_loc(obj: bpy.types.Object, frame: int, loc: Vector) -> None:
    obj.location = loc
    obj.keyframe_insert(data_path="location", frame=frame)


def key_rot(obj: bpy.types.Object, frame: int, rot: Euler) -> None:
    obj.rotation_euler = rot
    obj.keyframe_insert(data_path="rotation_euler", frame=frame)


def key_scale(obj: bpy.types.Object, frame: int, scale: Vector) -> None:
    obj.scale = scale
    obj.keyframe_insert(data_path="scale", frame=frame)


def key_hide(obj: bpy.types.Object, frame: int, hide: bool) -> None:
    obj.hide_viewport = hide
    obj.hide_render = hide
    obj.keyframe_insert(data_path="hide_viewport", frame=frame)
    obj.keyframe_insert(data_path="hide_render", frame=frame)


def fade_material_strength(mat: bpy.types.Material, frame: int, strength: float) -> None:
    """Keyframe emission strength if present."""
    if not mat or not mat.use_nodes:
        return
    for node in mat.node_tree.nodes:
        if node.type == "EMISSION" and "Strength" in node.inputs:
            node.inputs["Strength"].default_value = strength
            node.inputs["Strength"].keyframe_insert(data_path="default_value", frame=frame)
            return


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
def setup_scene() -> None:
    scene = bpy.context.scene
    scene.render.resolution_x = RES_X
    scene.render.resolution_y = RES_Y
    scene.render.resolution_percentage = 100
    scene.render.fps = FPS
    scene.frame_start = FRAME_START
    scene.frame_end = FRAME_END
    scene.frame_current = FRAME_START
    set_world_color()


def setup_camera(col: bpy.types.Collection) -> bpy.types.Object:
    cam_data = bpy.data.cameras.new("FORGE_Cam")
    cam_data.type = "PERSP"
    cam_data.lens = 35
    # DOF off for headless EEVEE speed (render script also forces off)
    cam_data.dof.use_dof = False
    cam_data.dof.aperture_fstop = 2.8
    cam = bpy.data.objects.new("FORGE_Cam", cam_data)
    link_to(cam, col)
    bpy.context.scene.camera = cam

    # Act 1 start: close/chaotic framing → dolly out + pan down
    start_loc = Vector((0.0, -4.2, 2.8))
    mid_loc = Vector((0.0, -7.5, 1.2))  # end Act 1 / Act 2
    end_loc = Vector((0.0, -5.2, 0.6))  # Act 3 dolly-in

    start_rot = Euler((math.radians(72), 0.0, 0.0), "XYZ")
    mid_rot = Euler((math.radians(78), 0.0, math.radians(-4)), "XYZ")
    end_rot = Euler((math.radians(82), 0.0, 0.0), "XYZ")

    key_loc(cam, FRAME_START, start_loc)
    key_rot(cam, FRAME_START, start_rot)
    key_loc(cam, ACT1_END, mid_loc)
    key_rot(cam, ACT1_END, mid_rot)
    # Hold through Act 2
    key_loc(cam, ACT2_END, mid_loc)
    key_rot(cam, ACT2_END, mid_rot)
    # Act 3 slow dolly-in
    key_loc(cam, ACT3_END, end_loc)
    key_rot(cam, ACT3_END, end_rot)
    set_ease_inout_fcurves(cam)

    # Focus object (badge plane at origin) — empty target
    focus = bpy.data.objects.new("DOF_Focus", None)
    focus.empty_display_size = 0.2
    focus.location = (0.0, 0.0, 0.0)
    link_to(focus, col)
    cam_data.dof.focus_object = focus
    return cam


def setup_lights(col: bpy.types.Collection) -> None:
    # Point lights (area lights are costly in headless EEVEE on weak iGPUs)
    rim_data = bpy.data.lights.new("Rim_Orange", type="POINT")
    rim_data.energy = 220
    rim_data.color = (1.0, 0.45, 0.1)
    rim = bpy.data.objects.new("Rim_Orange", rim_data)
    rim.location = (4.5, -1.5, 2.0)
    link_to(rim, col)

    fill_data = bpy.data.lights.new("Fill_Cyan", type="POINT")
    fill_data.energy = 140
    fill_data.color = (0.2, 0.9, 1.0)
    fill = bpy.data.objects.new("Fill_Cyan", fill_data)
    fill.location = (-4.0, -2.0, 1.5)
    link_to(fill, col)

    key_data = bpy.data.lights.new("Key_Overhead", type="POINT")
    key_data.energy = 180
    key_data.color = (0.95, 0.97, 1.0)
    key = bpy.data.objects.new("Key_Overhead", key_data)
    key.location = (0.0, -1.0, 6.0)
    link_to(key, col)


# ---------------------------------------------------------------------------
# Act 1 — Chaotic network
# ---------------------------------------------------------------------------
def build_network(nodes_col, edges_col) -> list[bpy.types.Object]:
    rng = random.Random(RNG_SEED)
    mat_cyan = make_emission("Node_Cyan", CYAN, strength=2.5)
    mat_orange = make_emission("Node_Orange", ORANGE, strength=2.2)

    nodes: list[bpy.types.Object] = []
    positions: list[Vector] = []

    for i in range(NODE_COUNT):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.08, location=(0, 0, 0))
        obj = bpy.context.active_object
        obj.name = f"NetNode_{i:02d}"
        # Scattered grid-ish volume
        loc = Vector(
            (
                rng.uniform(-2.8, 2.8),
                rng.uniform(-1.5, 1.5),
                rng.uniform(-2.2, 2.4),
            )
        )
        obj.location = loc
        obj.data.materials.append(mat_cyan if i % 2 == 0 else mat_orange)
        link_to(obj, nodes_col)
        positions.append(loc.copy())
        nodes.append(obj)

        # Key start position, converge to origin by Act2 end
        key_loc(obj, FRAME_START, loc)
        key_loc(obj, ACT1_END, loc)  # hold through Act 1
        # Slight jitter mid Act 1 for life
        jitter = loc + Vector((rng.uniform(-0.15, 0.15), rng.uniform(-0.1, 0.1), rng.uniform(-0.15, 0.15)))
        key_loc(obj, ACT1_END // 2, jitter)
        key_loc(obj, ACT1_END, loc)
        # Converge Act 2 with strong ease-out
        key_loc(obj, ACT2_END - 20, Vector((0.05 * (i % 3 - 1), 0.0, 0.05 * ((i // 3) % 3 - 1))))
        key_loc(obj, ACT2_END, Vector((0.0, 0.0, 0.0)))
        key_scale(obj, FRAME_START, Vector((1, 1, 1)))
        key_scale(obj, ACT2_END - 10, Vector((0.3, 0.3, 0.3)))
        key_scale(obj, ACT2_END, Vector((0.01, 0.01, 0.01)))
        key_hide(obj, ACT2_END, False)
        key_hide(obj, ACT2_END + 1, True)
        set_ease_out_fcurves(obj)

    # Thin edge lines — ring topology (one edge per node)
    edge_mat = make_emission("Edge_Neon", CYAN, strength=1.2)
    for i in range(NODE_COUNT):
        t = (i + 1) % NODE_COUNT
        a, b = positions[i], positions[t]
        curve = bpy.data.curves.new(f"EdgeCurve_{i}_{t}", type="CURVE")
        curve.dimensions = "3D"
        curve.bevel_depth = 0.01
        curve.bevel_resolution = 0
        spline = curve.splines.new("POLY")
        spline.points.add(1)  # 2 points (straight segment; cheaper)
        for pi, p in enumerate((a, b)):
            spline.points[pi].co = (p.x, p.y, p.z, 1.0)

        edge_obj = bpy.data.objects.new(f"NetEdge_{i}_{t}", curve)
        edge_obj.data.materials.append(edge_mat)
        link_to(edge_obj, edges_col)

        # Visible Act 1, dissolve/hide during Act 2
        key_hide(edge_obj, FRAME_START, False)
        key_scale(edge_obj, FRAME_START, Vector((1, 1, 1)))
        key_scale(edge_obj, ACT1_END, Vector((1, 1, 1)))
        key_scale(edge_obj, ACT1_END + 40, Vector((0.2, 0.2, 0.2)))
        key_hide(edge_obj, ACT1_END + 45, False)
        key_hide(edge_obj, ACT1_END + 46, True)
        set_ease_out_fcurves(edge_obj)

    return nodes


def build_act1_text(text_col: bpy.types.Collection) -> bpy.types.Object:
    curve = bpy.data.curves.new(name="Act1_TextData", type="FONT")
    curve.body = "Where skill meets opportunity..."
    curve.align_x = "CENTER"
    curve.size = 0.22
    obj = bpy.data.objects.new("Act1_Overlay", curve)
    obj.location = (0.0, -0.5, 2.6)
    obj.rotation_euler = Euler((math.radians(90), 0, 0), "XYZ")
    mat = make_soft_text("Act1_TextMat")
    obj.data.materials.append(mat)
    link_to(obj, text_col)

    # Fade in/out via scale + hide
    key_hide(obj, FRAME_START, True)
    key_hide(obj, 12, False)
    key_scale(obj, 12, Vector((0.01, 0.01, 0.01)))
    key_scale(obj, 30, Vector((1, 1, 1)))
    key_scale(obj, 85, Vector((1, 1, 1)))
    key_scale(obj, ACT1_END, Vector((0.01, 0.01, 0.01)))
    key_hide(obj, ACT1_END, False)
    key_hide(obj, ACT1_END + 1, True)
    set_ease_inout_fcurves(obj)
    return obj


# ---------------------------------------------------------------------------
# Act 2 — Shield / badge + pulse
# ---------------------------------------------------------------------------
def build_badge(badge_col: bpy.types.Collection) -> bpy.types.Object:
    glass_mat = make_glass()
    core_mat = make_emissive_core()
    edge_mat = make_cyan_edge()

    # Outer glass shell (leaner mesh for EEVEE)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.85, location=(0, 0, 0), segments=24, ring_count=16)
    shell = bpy.context.active_object
    shell.name = "Badge_GlassShell"
    shell.scale = (1.0, 0.35, 1.15)
    shell.data.materials.append(glass_mat)
    link_to(shell, badge_col)

    # Inner orange emissive core
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.38, location=(0, 0, 0), segments=16, ring_count=10)
    core = bpy.context.active_object
    core.name = "Badge_Core"
    core.scale = (1.0, 0.4, 1.1)
    core.data.materials.append(core_mat)
    link_to(core, badge_col)

    # Thin cyan edge accent (torus ring)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.9,
        minor_radius=0.035,
        major_segments=32,
        minor_segments=8,
        location=(0, 0, 0),
    )
    edge = bpy.context.active_object
    edge.name = "Badge_CyanEdge"
    edge.rotation_euler = Euler((math.radians(90), 0, 0), "XYZ")
    edge.scale = (1.0, 1.15, 0.4)
    edge.data.materials.append(edge_mat)
    link_to(edge, badge_col)

    # Parent core + edge under shell for Act 3 motion
    core.parent = shell
    edge.parent = shell

    # Hidden until Act 2, then grow in
    for obj in (shell, core, edge):
        key_hide(obj, FRAME_START, True)
        key_hide(obj, ACT1_END, True)
        key_hide(obj, ACT1_END + 1, False)

    key_scale(shell, ACT1_END + 1, Vector((0.01, 0.01, 0.01)))
    key_scale(shell, ACT1_END + 50, Vector((1.0, 0.35, 1.15)))
    key_scale(shell, ACT2_END, Vector((1.0, 0.35, 1.15)))
    # Act 3: front-facing center (already at origin); subtle settle
    key_loc(shell, ACT2_END, Vector((0, 0, 0.15)))
    key_loc(shell, ACT2_END + 40, Vector((0, 0, 0.55)))
    key_loc(shell, ACT3_END, Vector((0, 0, 0.55)))
    key_rot(shell, ACT2_END, Euler((0, 0, math.radians(25)), "XYZ"))
    key_rot(shell, ACT2_END + 50, Euler((0, 0, 0), "XYZ"))
    key_rot(shell, ACT3_END, Euler((0, 0, 0), "XYZ"))
    set_ease_out_fcurves(shell)

    return shell


def build_pulse_ring(badge_col: bpy.types.Collection) -> bpy.types.Object:
    pulse_mat = make_emission("Pulse_Cyan", CYAN, strength=5.0)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.6,
        minor_radius=0.025,
        major_segments=24,
        minor_segments=6,
        location=(0, 0, 0),
    )
    ring = bpy.context.active_object
    ring.name = "Pulse_Ring"
    ring.rotation_euler = Euler((math.radians(90), 0, 0), "XYZ")
    ring.data.materials.append(pulse_mat)
    link_to(ring, badge_col)

    key_hide(ring, FRAME_START, True)
    key_hide(ring, ACT1_END + 20, True)
    key_hide(ring, ACT1_END + 21, False)
    key_scale(ring, ACT1_END + 21, Vector((0.3, 0.3, 0.3)))
    key_scale(ring, ACT1_END + 90, Vector((3.5, 3.5, 0.5)))
    fade_material_strength(pulse_mat, ACT1_END + 21, 6.0)
    fade_material_strength(pulse_mat, ACT1_END + 90, 0.0)
    key_hide(ring, ACT1_END + 95, False)
    key_hide(ring, ACT1_END + 96, True)
    set_ease_out_fcurves(ring)
    return ring


def build_act2_text(text_col: bpy.types.Collection) -> bpy.types.Object:
    curve = bpy.data.curves.new(name="Act2_TextData", type="FONT")
    curve.body = "West Africa's digital engine for skilled hands."
    curve.align_x = "CENTER"
    curve.size = 0.16
    obj = bpy.data.objects.new("Act2_Overlay", curve)
    obj.location = (0.0, -0.5, -2.0)
    obj.rotation_euler = Euler((math.radians(90), 0, 0), "XYZ")
    mat = make_soft_text("Act2_TextMat")
    obj.data.materials.append(mat)
    link_to(obj, text_col)

    key_hide(obj, FRAME_START, True)
    key_hide(obj, ACT1_END + 30, True)
    key_hide(obj, ACT1_END + 31, False)
    key_scale(obj, ACT1_END + 31, Vector((0.01, 0.01, 0.01)))
    key_scale(obj, ACT1_END + 55, Vector((1, 1, 1)))
    key_scale(obj, ACT2_END - 20, Vector((1, 1, 1)))
    key_scale(obj, ACT2_END, Vector((0.01, 0.01, 0.01)))
    key_hide(obj, ACT2_END, False)
    key_hide(obj, ACT2_END + 1, True)
    set_ease_inout_fcurves(obj)
    return obj


# ---------------------------------------------------------------------------
# Act 3 — Logo + CTA
# ---------------------------------------------------------------------------
def build_logo_text(text_col: bpy.types.Collection) -> tuple[bpy.types.Object, bpy.types.Object]:
    metal = make_metal_text()
    soft = make_soft_text("CTA_Soft")

    forge_data = bpy.data.curves.new(name="FORGE_LogoData", type="FONT")
    forge_data.body = "FORGE"
    forge_data.align_x = "CENTER"
    forge_data.size = 0.55
    forge_data.extrude = 0.04
    forge_data.bevel_depth = 0.0
    forge = bpy.data.objects.new("Logo_FORGE", forge_data)
    forge.location = (0.0, 0.15, -0.55)
    forge.rotation_euler = Euler((math.radians(90), 0, 0), "XYZ")
    forge.data.materials.append(metal)
    link_to(forge, text_col)

    sub_data = bpy.data.curves.new(name="CTA_SubData", type="FONT")
    sub_data.body = "Where Work Meets Hands."
    sub_data.align_x = "CENTER"
    sub_data.size = 0.18
    sub = bpy.data.objects.new("CTA_Subtext", sub_data)
    sub.location = (0.0, 0.1, -1.15)
    sub.rotation_euler = Euler((math.radians(90), 0, 0), "XYZ")
    sub.data.materials.append(soft)
    link_to(sub, text_col)

    for obj, appear in ((forge, ACT2_END + 10), (sub, ACT2_END + 35)):
        key_hide(obj, FRAME_START, True)
        key_hide(obj, appear - 1, True)
        key_hide(obj, appear, False)
        key_scale(obj, appear, Vector((0.01, 0.01, 0.01)))
        key_scale(obj, appear + 25, Vector((1, 1, 1)))
        key_scale(obj, ACT3_END, Vector((1, 1, 1)))
        set_ease_out_fcurves(obj)

    return forge, sub


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    clear_scene()
    # Remove default collection clutter — keep scene root
    setup_scene()

    nodes_col = ensure_collection("NET_NODES")
    edges_col = ensure_collection("NET_EDGES")
    badge_col = ensure_collection("BADGE")
    text_col = ensure_collection("TEXT")
    lights_col = ensure_collection("LIGHTS")
    cam_col = ensure_collection("CAM")

    setup_camera(cam_col)
    setup_lights(lights_col)
    build_network(nodes_col, edges_col)
    build_act1_text(text_col)
    build_badge(badge_col)
    build_pulse_ring(badge_col)
    build_act2_text(text_col)
    build_logo_text(text_col)

    # EEVEE preview-friendly defaults on scene (render script sets final)
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except Exception:
        try:
            scene.render.engine = "BLENDER_EEVEE"
        except Exception:
            pass

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    print(f"[FORGE] Scene built → {BLEND_PATH}")
    print(f"[FORGE] Frames {FRAME_START}-{FRAME_END} @ {FPS}fps, {RES_X}x{RES_Y}")


if __name__ == "__main__":
    main()
