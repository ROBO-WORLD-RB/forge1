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

## Render a video

Render the default composition (`HelloForge`) to `out/`:

```bash
npm run render
```

Render a specific composition:

```bash
npx remotion render HelloForge out/hello-forge.mp4
npx remotion render BrandIntro out/brand-intro.mp4
```

Bundle for deployment / CI:

```bash
npm run build
```

## Sample compositions

| ID           | Length | Purpose                                      |
| ------------ | ------ | -------------------------------------------- |
| `HelloForge` | 3s     | Minimal branded mark + accent bar            |
| `BrandIntro` | 5s     | Wordmark + tagline (slightly longer intro)   |

Brand colors live in `src/brand.ts` (navy `#1A1A1A`, orange `#FF7A00` — aligned with the main app).

## Folder structure

```
marketing/
├── package.json          # Own Remotion deps & scripts
├── remotion.config.ts
├── tsconfig.json
├── README.md
├── out/                  # Rendered videos (gitignored)
└── src/
    ├── index.ts          # registerRoot
    ├── Root.tsx          # Composition registry
    ├── brand.ts          # FORGE color / video tokens
    ├── HelloForge.tsx
    ├── BrandIntro.tsx
    └── index.css
```

## Notes

- Output files go to `marketing/out/` (ignored by git).
- `@remotion/player` is installed for optional in-app previews later; Studio does not require it.
- Remotion is free for teams of up to 3 — see [license terms](https://www.remotion.dev/docs/license) for company use.
