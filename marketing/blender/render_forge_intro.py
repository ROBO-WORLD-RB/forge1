"""
Render the FORGE 3D intro to a vertical EEVEE MP4.

Output: marketing/out/forge-3d-intro.mp4
Run: blender --background --python marketing/blender/render_forge_intro.py

Headless EEVEE on weak iGPUs: no RT/MB/compositor/shadows, low TAA,
shader warm-up, optional half-res + ffmpeg upscale to 1080×1920.

Optional args (after --):
  --benchmark [FRAME]   Time a single frame (default 180), then exit
  --qa-only             Render QA stills only (no full animation)
  --half-res            Force 50% render + ffmpeg upscale
  --full-res            Force 100% (default prefers 100% if fast enough)
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import time
from pathlib import Path

import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
BLEND_PATH = SCRIPT_DIR / "forge_intro.blend"
OUT_DIR = SCRIPT_DIR.parent / "out"
OUT_MP4 = OUT_DIR / "forge-3d-intro.mp4"
FRAMES_DIR = OUT_DIR / "forge-3d-intro_frames"
QA_DIR = OUT_DIR / "forge-3d-intro_qa"

FPS = 60
FRAME_START = 1
FRAME_END = 360
RES_X = 1080
RES_Y = 1920
QA_FRAMES = (1, 108, 228, 360)

TAA_SAMPLES = 1
# Prefer 100%; auto-drop to 50% if warm bench > 2.5s (iGPU often needs half-res)
TARGET_SEC_PER_FRAME = 2.5


def _parse_cli() -> dict:
    argv = sys.argv
    args = argv[argv.index("--") + 1 :] if "--" in argv else []
    cfg = {
        "benchmark": False,
        "bench_frame": 180,
        "qa_only": False,
        "force_half": False,
        "force_full": False,
    }
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--benchmark":
            cfg["benchmark"] = True
            if i + 1 < len(args) and args[i + 1].isdigit():
                cfg["bench_frame"] = int(args[i + 1])
                i += 1
        elif a == "--qa-only":
            cfg["qa_only"] = True
        elif a == "--half-res":
            cfg["force_half"] = True
        elif a == "--full-res":
            cfg["force_full"] = True
        i += 1
    return cfg


def ensure_blend() -> None:
    if BLEND_PATH.exists():
        bpy.ops.wm.open_mainfile(filepath=str(BLEND_PATH))
        return
    if str(SCRIPT_DIR) not in sys.path:
        sys.path.insert(0, str(SCRIPT_DIR))
    import build_forge_intro  # noqa: WPS433

    build_forge_intro.main()
    bpy.ops.wm.open_mainfile(filepath=str(BLEND_PATH))


def configure_eevee(scene: bpy.types.Scene, res_percent: int = 100) -> None:
    """Fast headless EEVEE — emission glow only."""
    # Blender 5.0 uses BLENDER_EEVEE (EEVEE_NEXT enum removed)
    scene.render.engine = "BLENDER_EEVEE"

    scene.render.resolution_x = RES_X
    scene.render.resolution_y = RES_Y
    scene.render.resolution_percentage = res_percent
    scene.render.fps = FPS
    scene.frame_start = FRAME_START
    scene.frame_end = FRAME_END

    if hasattr(scene.render, "use_motion_blur"):
        scene.render.use_motion_blur = False
    if hasattr(scene.render, "use_compositing"):
        scene.render.use_compositing = False
    scene.compositing_node_group = None

    cam = scene.camera
    if cam and cam.data and hasattr(cam.data, "dof"):
        cam.data.dof.use_dof = False

    eevee = getattr(scene, "eevee", None)
    if eevee is not None:
        if hasattr(eevee, "use_bloom"):
            eevee.use_bloom = True
            if hasattr(eevee, "bloom_intensity"):
                eevee.bloom_intensity = 0.45
            if hasattr(eevee, "bloom_threshold"):
                eevee.bloom_threshold = 0.6
        if hasattr(eevee, "use_motion_blur"):
            eevee.use_motion_blur = False
        if hasattr(eevee, "taa_render_samples"):
            eevee.taa_render_samples = TAA_SAMPLES
        if hasattr(eevee, "taa_samples"):
            eevee.taa_samples = 1
        if hasattr(eevee, "use_raytracing"):
            eevee.use_raytracing = False
        if hasattr(eevee, "use_shadows"):
            eevee.use_shadows = False
        for attr, val in (
            ("use_volumetric_shadows", False),
            ("use_volume_shadows", False),
            ("use_gtao", False),
            ("use_ssr", False),
            ("use_ssr_refraction", False),
            ("use_overscan", False),
            ("use_soft_shadows", False),
        ):
            if hasattr(eevee, attr):
                setattr(eevee, attr, val)

    print(
        f"[FORGE] EEVEE: TAA={TAA_SAMPLES}, res%={res_percent}, "
        f"RT=off, MB=off, shadows=off, compositor=off, DOF=off"
    )


def warm_shaders(scene: bpy.types.Scene) -> None:
    """First EEVEE frame in background can take minutes (shader compile)."""
    print("[FORGE] Warming EEVEE shaders (first frame may take 1–3 min)…")
    prev_x = scene.render.resolution_x
    prev_y = scene.render.resolution_y
    prev_pct = scene.render.resolution_percentage
    prev_path = scene.render.filepath
    prev_fmt = scene.render.image_settings.file_format

    scene.render.resolution_x = 64
    scene.render.resolution_y = 64
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    warm_path = OUT_DIR / "_eevee_warm"
    scene.render.filepath = str(warm_path)
    scene.frame_set(FRAME_START)
    t0 = time.perf_counter()
    bpy.ops.render.render(write_still=True)
    print(f"[FORGE] Shader warm-up done in {time.perf_counter() - t0:.1f}s")

    scene.render.resolution_x = prev_x
    scene.render.resolution_y = prev_y
    scene.render.resolution_percentage = prev_pct
    scene.render.filepath = prev_path
    try:
        scene.render.image_settings.file_format = prev_fmt
    except TypeError:
        scene.render.image_settings.file_format = "PNG"


def try_configure_ffmpeg(scene: bpy.types.Scene) -> bool:
    try:
        scene.render.image_settings.file_format = "FFMPEG"
    except TypeError:
        return False
    scene.render.ffmpeg.format = "MPEG4"
    scene.render.ffmpeg.codec = "H264"
    scene.render.ffmpeg.constant_rate_factor = "MEDIUM"
    scene.render.ffmpeg.ffmpeg_preset = "GOOD"
    scene.render.ffmpeg.audio_codec = "NONE"
    scene.render.filepath = str(OUT_DIR / "forge-3d-intro")
    scene.render.use_file_extension = True
    return True


def configure_png_sequence(scene: bpy.types.Scene) -> None:
    if FRAMES_DIR.exists():
        shutil.rmtree(FRAMES_DIR)
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.filepath = str(FRAMES_DIR / "frame_")
    scene.render.use_file_extension = True


def find_ffmpeg() -> str | None:
    which = shutil.which("ffmpeg")
    if which:
        return which
    candidates = [
        Path(r"C:\Users\JERRY JUSTICE\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe"),
        Path(r"C:\ffmpeg\bin\ffmpeg.exe"),
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    return None


def encode_mp4_from_pngs(upscale: bool) -> Path:
    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        raise RuntimeError("ffmpeg not found on PATH; cannot mux PNG sequence to MP4")

    vf = []
    if upscale:
        vf = ["-vf", f"scale={RES_X}:{RES_Y}:flags=lanczos"]

    cmd = [
        ffmpeg,
        "-y",
        "-framerate",
        str(FPS),
        "-start_number",
        str(FRAME_START),
        "-i",
        str(FRAMES_DIR / "frame_%04d.png"),
        *vf,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "18",
        "-movflags",
        "+faststart",
        str(OUT_MP4),
    ]
    print(f"[FORGE] Encoding MP4 via: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)
    return OUT_MP4


def render_qa_stills(scene: bpy.types.Scene) -> None:
    QA_DIR.mkdir(parents=True, exist_ok=True)
    prev_path = scene.render.filepath
    prev_format = scene.render.image_settings.file_format
    scene.render.image_settings.file_format = "PNG"
    for f in QA_FRAMES:
        scene.frame_set(f)
        scene.render.filepath = str(QA_DIR / f"qa_{f:04d}")
        scene.render.use_file_extension = True
        bpy.ops.render.render(write_still=True)
        print(f"[FORGE] QA still → {QA_DIR / f'qa_{f:04d}.png'}")
    scene.render.filepath = prev_path
    try:
        scene.render.image_settings.file_format = prev_format
    except TypeError:
        scene.render.image_settings.file_format = "PNG"


def benchmark_frame(scene: bpy.types.Scene, frame: int) -> float:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    bench_path = OUT_DIR / f"forge-3d-intro_bench_{frame:04d}"
    scene.frame_set(frame)
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(bench_path)
    scene.render.use_file_extension = True
    print(f"[FORGE] Benchmarking frame {frame} @ {scene.render.resolution_percentage}%…")
    t0 = time.perf_counter()
    bpy.ops.render.render(write_still=True)
    elapsed = time.perf_counter() - t0
    print(f"[FORGE] BENCH frame {frame}: {elapsed:.3f}s")
    print(f"[FORGE] Projected 360f: {elapsed * 360 / 60:.1f} min")
    return elapsed


def choose_res_percent(scene: bpy.types.Scene, cfg: dict) -> tuple[int, bool]:
    """Return (res_percent, need_ffmpeg_upscale)."""
    if cfg["force_half"]:
        return 50, True
    if cfg["force_full"]:
        return 100, False

    # Auto: warm already done; probe frame 180 at 100%
    scene.render.resolution_percentage = 100
    elapsed = benchmark_frame(scene, 180)
    if elapsed <= TARGET_SEC_PER_FRAME:
        print(f"[FORGE] Using 100% ({elapsed:.2f}s/frame ≤ {TARGET_SEC_PER_FRAME}s)")
        return 100, False

    print(f"[FORGE] 100% too slow ({elapsed:.2f}s) — switching to 50% + ffmpeg upscale")
    scene.render.resolution_percentage = 50
    elapsed_h = benchmark_frame(scene, 180)
    print(f"[FORGE] Half-res bench: {elapsed_h:.3f}s/frame")
    return 50, True


def main() -> None:
    cfg = _parse_cli()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ensure_blend()
    scene = bpy.context.scene
    configure_eevee(scene, res_percent=100)
    warm_shaders(scene)

    if cfg["benchmark"]:
        if cfg["force_half"]:
            scene.render.resolution_percentage = 50
        elapsed = benchmark_frame(scene, cfg["bench_frame"])
        # Exit 0 even if slow — report only (full render decides half-res)
        print(f"[FORGE] Bench complete: {elapsed:.3f}s/frame")
        sys.exit(0 if elapsed <= 8.0 else 2)

    if cfg["qa_only"]:
        render_qa_stills(scene)
        return

    res_pct, upscale = choose_res_percent(scene, cfg)
    configure_eevee(scene, res_percent=res_pct)

    # Always PNG sequence when upscaling; otherwise try Blender FFMPEG
    use_ffmpeg = False
    if upscale:
        print("[FORGE] Half-res path — PNG sequence + ffmpeg upscale")
        configure_png_sequence(scene)
    else:
        use_ffmpeg = try_configure_ffmpeg(scene)
        if not use_ffmpeg:
            print("[FORGE] Blender FFMPEG unavailable — PNG sequence + ffmpeg")
            configure_png_sequence(scene)

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

    print(f"[FORGE] Rendering animation {FRAME_START}-{FRAME_END} @ {res_pct}%…")
    t0 = time.perf_counter()
    bpy.ops.render.render(animation=True)
    anim_elapsed = time.perf_counter() - t0
    print(
        f"[FORGE] Animation wall: {anim_elapsed:.1f}s "
        f"({anim_elapsed / 360:.3f}s/frame avg)"
    )

    if use_ffmpeg:
        produced = OUT_DIR / "forge-3d-intro.mp4"
        if not produced.exists():
            candidates = list(OUT_DIR.glob("forge-3d-intro*"))
            if candidates:
                produced = max(candidates, key=lambda p: p.stat().st_mtime)
    else:
        produced = encode_mp4_from_pngs(upscale=upscale)

    if produced.exists() and produced != OUT_MP4:
        # Normalize name
        if produced.suffix.lower() == ".mp4":
            shutil.copy2(produced, OUT_MP4)
            produced = OUT_MP4

    if OUT_MP4.exists():
        size_mb = OUT_MP4.stat().st_size / (1024 * 1024)
        print(f"[FORGE] OK: {OUT_MP4} ({size_mb:.2f} MB)")
    else:
        print("[FORGE] ERROR: MP4 not found after render", file=sys.stderr)
        sys.exit(1)

    # QA at same res% used for animation
    print("[FORGE] Rendering QA keyframes…")
    render_qa_stills(scene)


if __name__ == "__main__":
    main()
