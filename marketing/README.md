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
Select **`ForgeSpark`** in the composition list for the cinematic marketing intro.

## Render a video

Render the default composition (`HelloForge`) to `out/`:

```bash
npm run render
```

Render the cinematic intro (`ForgeSpark`, 28s):

```bash
npm run render:spark
```

Or render any composition by id:

```bash
npx remotion render HelloForge out/hello-forge.mp4
npx remotion render BrandIntro out/brand-intro.mp4
npx remotion render ForgeSpark out/forge-spark.mp4
```

Quick still (sanity-check a frame at 1s):

```bash
npx remotion still ForgeSpark --scale=0.25 --frame=30
```

Bundle for deployment / CI:

```bash
npm run build
```

## Compositions

| ID           | Length | Purpose                                                                 |
| ------------ | ------ | ----------------------------------------------------------------------- |
| `HelloForge` | 3s     | Minimal branded mark + accent bar                                       |
| `BrandIntro` | 5s     | Wordmark + tagline (short intro)                                        |
| `ForgeSpark` | 28s    | Trailer cold-open: ember → need → skill → match → strike → brand lockup |

### ForgeSpark creative

Dark industrial cold open. A single ember wakes curiosity, then kinetic type asks *Looking for hands?* Need and skill face each other across the frame; an orange spark draws the match between them. A forge-strike bursts sparks and hammers the **FORGE** letters into place, landing on: **Where work meets hands.**

Brand colors live in `src/brand.ts` (navy `#1A1A1A`, orange `#FF7A00` — aligned with the main app).

## Folder structure

```
marketing/
├── package.json
├── remotion.config.ts
├── tsconfig.json
├── README.md
├── out/                          # Rendered videos (gitignored)
└── src/
    ├── index.ts
    ├── Root.tsx                  # Composition registry
    ├── brand.ts
    ├── HelloForge.tsx
    ├── BrandIntro.tsx
    ├── index.css
    └── compositions/
        └── ForgeSpark/
            ├── index.tsx         # Composition registration
            ├── ForgeSpark.tsx    # Timeline / Sequences
            ├── timing.ts
            ├── fonts.ts
            ├── components/
            └── scenes/
```

## Notes

- Output files go to `marketing/out/` (ignored by git).
- `@remotion/player` is installed for optional in-app previews later; Studio does not require it.
- `@remotion/google-fonts` powers Bebas Neue + Outfit in `ForgeSpark`.
- Remotion is free for teams of up to 3 — see [license terms](https://www.remotion.dev/docs/license) for company use.
