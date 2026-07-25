# FORGE Blender 3D Intro

6-second vertical (1080×1920 @ 60fps) motion-graphics intro: chaotic network → glassmorphic shield → FORGE logo/CTA.

Text overlays only (no voiceover in v1).

## Files

| File | Purpose |
|------|---------|
| `build_forge_intro.py` | Clears scene, builds Acts 1–3, saves `forge_intro.blend` |
| `render_forge_intro.py` | Fast headless EEVEE → `../out/forge-3d-intro.mp4` |
| `materials.py` | Glass / neon / metal helpers |
| `forge_intro.blend` | Regenerable (gitignored) |

## One-command re-render (CLI)

Requires [Blender](https://www.blender.org/) 4.2+ (tested on **Blender 5.0.1**). System `ffmpeg` is used to mux/upscale (WinGet `ffmpeg` on PATH is fine).

From the repo root (`fg/`):

```powershell
$BLENDER = "C:\Program Files\Blender Foundation\Blender 5.0\blender.exe"

# 1) Rebuild scene (.blend) — lean meshes / opaque glass / point lights
& $BLENDER --background --python marketing/blender/build_forge_intro.py

# 2) Render MP4 (half-res EEVEE + ffmpeg Lanczos upscale to 1080×1920)
#    First EEVEE frame warms shaders (~2 min on Intel UHD); then ~1.2s/frame.
& $BLENDER --background --python marketing/blender/render_forge_intro.py -- --half-res
```

### Useful flags (after `--`)

| Flag | Meaning |
|------|---------|
| `--half-res` | Render at 50% then ffmpeg-upscale (recommended on iGPU) |
| `--full-res` | Force 100% (auto path uses this only if warm bench ≤ 2.5s/frame) |
| `--benchmark [N]` | Time one frame (default 180) after shader warm-up, then exit |
| `--qa-only` | Write QA stills only |

Benchmark example:

```powershell
& $BLENDER --background --python marketing/blender/render_forge_intro.py -- --benchmark 180 --half-res
```

If `blender` is on your `PATH`:

```bash
blender --background --python marketing/blender/build_forge_intro.py
blender --background --python marketing/blender/render_forge_intro.py -- --half-res
```

Output: `marketing/out/forge-3d-intro.mp4` (gitignored; do not push).

QA stills: `marketing/out/forge-3d-intro_qa/qa_0001.png` … `qa_0360.png`.

## Headless EEVEE speed notes (actual)

On Blender 5.0 headless + Intel UHD-class iGPU:

- First EEVEE still can take **~2 minutes** (shader compile). The render script warms a 64×64 frame first.
- Full quality settings (RT / compositor Glare / motion blur / DOF / area lights / alpha glass) were **~200s/frame** — unusable.
- Tuned path used for the shipped local MP4:
  - Engine `BLENDER_EEVEE` (no `EEVEE_NEXT` enum in 5.0)
  - Ray tracing / motion blur / shadows / compositor / DOF **off**
  - TAA render samples **1**
  - **50%** resolution PNG sequence → ffmpeg `scale=1080:1920:flags=lanczos`
  - Opaque metallic+emission “glass” shell; point lights; lean network (10 nodes)
- Measured: **~1.24s/frame** avg (360f animation wall ~7.5 min after warm-up).

## Blender MCP (optional)

1. Start Blender with the Blender MCP addon/server running.
2. In Cursor, complete **user-blender** MCP auth (approval card).
3. Prefer CLI for full animation renders; MCP is optional for interactive scrubbing.

If MCP is unavailable or auth times out, use the CLI path above — it is the supported path.

## Specs

- **Resolution:** 1080 × 1920 (9:16) final MP4
- **FPS:** 60
- **Duration:** 6.0s (frames 1–360)
- **Engine:** EEVEE (headless-optimized)
- **World:** `#0D1117`
- **Accents:** cyan `#00F2FE`, orange `#FF6B00`, glass white

### Acts

1. **1–108** — Chaotic emissive network, dolly out; overlay *Where skill meets opportunity...*
2. **108–228** — Nodes converge; shield + cyan pulse; overlay *West Africa's digital engine for skilled hands.*
3. **228–360** — Badge resolve, extruded **FORGE** + *Where Work Meets Hands.*; slow dolly-in

## Git

Commit **scripts + this README only**. Do not commit `*.blend` or `marketing/out/*.mp4`.
