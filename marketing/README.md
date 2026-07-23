# FORGE Marketing (Remotion)

Self-contained Remotion workspace for FORGE motion-graphics and promo videos.  
This package is **separate** from the main Vite marketplace app — do not mix deps with the repo root.

## Requirements

- **Node.js** `>= 18` (Remotion 4; Node 20+ recommended)
- npm (ships with Node)

## Install

From the repo root:

```bash
cd marketing
npm install
```

## Run Studio (preview)

```bash
npm run studio
```

Alias (same as Remotion default):

```bash
npm run dev
```

Opens Remotion Studio so you can scrub compositions and tweak Interactive props.  
Select **`ForgeIntro`** in the composition list for the cinematic marketing intro, or **`ProblemStory`** for the vertical TikTok/Reels problem narrative.

## Render a video

Render the default composition (`HelloForge`) to `out/`:

```bash
npm run render
```

Render the cinematic intro (`ForgeIntro`, 66s):

```bash
npm run render:intro
```

Render the vertical problem story (`ProblemStory`, 30s, 1080×1920):

```bash
npm run render:problem
```

Or render any composition by id:

```bash
npx remotion render HelloForge out/hello-forge.mp4
npx remotion render BrandIntro out/brand-intro.mp4
npx remotion render ForgeIntro out/forge-intro.mp4
npx remotion render ProblemStory out/problem-story.mp4
```

Quick still (sanity-check a frame at 1s):

```bash
npx remotion still ForgeIntro --scale=0.25 --frame=30
```

Bundle for deployment / CI:

```bash
npm run build
```

## Compositions

| ID             | Length | Size       | Purpose                                                                 |
| -------------- | ------ | ---------- | ----------------------------------------------------------------------- |
| `HelloForge`   | 3s     | 1920×1080  | Minimal branded mark + accent bar                                       |
| `BrandIntro`   | 5s     | 1920×1080  | Wordmark + tagline (short intro)                                        |
| `ForgeIntro`   | 66s    | 1920×1080  | Questions that need an answer → silence → FORGE brand reveal + narration |
| `ProblemStory` | 30s    | 1080×1920  | Vertical problem beats (pipe, rain, trust, hands) → FORGE tease         |

### ForgeIntro creative

A short film of unanswered questions — pipe bursts, rains, trust, skilled hands looking for work — held in soft crossfades and kinetic type. A quiet beat names the need (“You need an answer.”), then **FORGE** arrives as the answer: **Where work meets hands.** No fireworks, no spark bursts.

Brand colors live in `src/brand.ts` (navy `#1A1A1A`, orange `#FF7A00` — aligned with the main app).

### ProblemStory creative

A **30-second vertical** cut for TikTok/Reels — animated SVG illustrations show the problems FORGE solves (burst pipe, rain damage, trust gap, idle skilled hands), with minimal kinetic captions. Ends with a light **FORGE** wordmark tease; full brand reveal stays in `ForgeIntro`. Same cinematic restraint: soft fades, atmosphere, film grain — no fireworks.

### Motion Canvas

**Motion Canvas** is available on the dev machine for future illustration work. Use it when a scene needs a richer vector animation timeline (complex paths, multi-step morphs, physics-style motion) that would be tedious to hand-code in Remotion.

| Tool | Best for |
| ---- | -------- |
| **Remotion** | Compositing, kinetic captions, transitions, audio, brand lockups, final export pipeline (MP4, stills, CI) |
| **Motion Canvas** | Authoring complex SVG/vector animation scenes in isolation |

**Current approach (ProblemStory v1):** Illustrations are Remotion SVG components with `interpolate()` — no Motion Canvas dependency, no extra export step. For a future beat that outgrows inline SVG, render the scene from Motion Canvas to `public/illustrations/` (WebM or PNG sequence) and embed in Remotion via `<Video>` or `<Img>` inside `ProblemBeat`.

### ForgeIntro narration audio

Narration lives at **`public/audio/forge-intro-narration-full.wav`** (~238s). It is wired in `ForgeIntro.tsx` via `<Audio>` from `@remotion/media`, starting at frame 0 with no offset. The composition runs 66s, so only the first ~66s of the track plays; scrub in Studio to spot-check sync with on-screen lines.

## Folder structure

```
marketing/
├── package.json
├── remotion.config.ts
├── tsconfig.json
├── README.md
├── public/
│   └── audio/
│       └── forge-intro-narration-full.wav   # ForgeIntro narration (~238s)
├── out/                          # Rendered videos (gitignored)
└── src/
    ├── index.ts
    ├── Root.tsx                  # Composition registry
    ├── brand.ts
    ├── shared/                   # Atmosphere, FilmGrain, CompanyLockup, KineticLine, fonts
    ├── HelloForge.tsx
    ├── BrandIntro.tsx
    ├── index.css
    └── compositions/
        ├── ForgeIntro/
        │   ├── index.tsx         # Composition registration
        │   ├── ForgeIntro.tsx    # TransitionSeries timeline
        │   ├── timing.ts
        │   └── scenes/
        └── ProblemStory/
            ├── index.tsx         # Composition registration (1080×1920)
            ├── ProblemStory.tsx  # TransitionSeries timeline
            ├── timing.ts
            └── components/
                ├── ProblemBeat.tsx
                ├── CaptionLine.tsx
                ├── ForgeTease.tsx
                └── illustrations/
```

## Notes

- Output files go to `marketing/out/` (ignored by git).
- `@remotion/player` is installed for optional in-app previews later; Studio does not require it.
- `@remotion/google-fonts` powers Bebas Neue + Outfit in `ForgeIntro`.
- `@remotion/transitions` powers soft fades and slides between beats.
- Remotion is free for teams of up to 3 — see [license terms](https://www.remotion.dev/docs/license) for company use.
