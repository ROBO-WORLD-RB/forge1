"""Material helpers for the FORGE 3D intro (glass / neon / metal)."""

from __future__ import annotations

import bpy

# Brand palette (linear-ish sRGB floats 0–1)
CYAN = (0.0, 0.949, 0.996, 1.0)  # #00F2FE
ORANGE = (1.0, 0.420, 0.0, 1.0)  # #FF6B00
GLASS_WHITE = (0.92, 0.95, 0.98, 1.0)
METAL_WHITE = (0.88, 0.90, 0.93, 1.0)
WORLD_BG = (0.051, 0.067, 0.090, 1.0)  # #0D1117


def _ensure_nodes(mat: bpy.types.Material) -> bpy.types.ShaderNodeTree:
    mat.use_nodes = True
    tree = mat.node_tree
    tree.nodes.clear()
    return tree


def make_emission(name: str, color, strength: float = 2.0) -> bpy.types.Material:
    mat = bpy.data.materials.new(name=name)
    tree = _ensure_nodes(mat)
    nodes, links = tree.nodes, tree.links
    out = nodes.new("ShaderNodeOutputMaterial")
    em = nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = color
    em.inputs["Strength"].default_value = strength
    links.new(em.outputs["Emission"], out.inputs["Surface"])
    return mat


def make_glass(name: str = "FORGE_Glass") -> bpy.types.Material:
    """Opaque frosted shell + emission (no alpha/transmission — EEVEE headless speed)."""
    mat = bpy.data.materials.new(name=name)
    tree = _ensure_nodes(mat)
    nodes, links = tree.nodes, tree.links
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (0.82, 0.9, 0.96, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.35
    bsdf.inputs["Metallic"].default_value = 0.55
    bsdf.inputs["IOR"].default_value = 1.45
    if "Transmission Weight" in bsdf.inputs:
        bsdf.inputs["Transmission Weight"].default_value = 0.0
    elif "Transmission" in bsdf.inputs:
        bsdf.inputs["Transmission"].default_value = 0.0
    if "Alpha" in bsdf.inputs:
        bsdf.inputs["Alpha"].default_value = 1.0
    if "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (0.55, 0.85, 1.0, 1.0)
    if "Emission Strength" in bsdf.inputs:
        bsdf.inputs["Emission Strength"].default_value = 0.8
    if hasattr(mat, "blend_method"):
        mat.blend_method = "OPAQUE"
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def make_emissive_core(name: str = "FORGE_Core") -> bpy.types.Material:
    return make_emission(name, ORANGE, strength=6.0)


def make_cyan_edge(name: str = "FORGE_CyanEdge") -> bpy.types.Material:
    return make_emission(name, CYAN, strength=4.0)


def make_metal_text(name: str = "FORGE_MetalText") -> bpy.types.Material:
    mat = bpy.data.materials.new(name=name)
    tree = _ensure_nodes(mat)
    nodes, links = tree.nodes, tree.links
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = METAL_WHITE
    bsdf.inputs["Metallic"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = 0.25
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.6
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def make_soft_text(name: str = "FORGE_SoftText") -> bpy.types.Material:
    """Soft emissive subtitles (opaque — avoids EEVEE alpha sorting cost)."""
    return make_emission(name, GLASS_WHITE, strength=1.8)


def set_world_color(color=WORLD_BG) -> None:
    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    bg = nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = color
    bg.inputs["Strength"].default_value = 1.0
    out = nodes.new("ShaderNodeOutputWorld")
    links.new(bg.outputs["Background"], out.inputs["Surface"])
