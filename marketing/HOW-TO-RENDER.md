# How to render FORGE marketing videos

All commands run from the `marketing/` folder.

## Install

```bash
cd marketing
npm install
```

Requires **Node.js ≥ 18** (20+ recommended).

## Preview in Studio

```bash
npm run studio
```

Open compositions in the left sidebar:

| Composition    | Format                         | Notes                                      |
| -------------- | ------------------------------ | ------------------------------------------ |
| `Blackout`     | 1080×1920 @ 60fps (60s)        | Hardcore power-outage trailer              |
| `ForgePitch`   | 1920×1080 @ 30fps (~2:10)      | Investor narrative — edit props / JSON     |
| `ForgeReel`    | 1080×1920 @ 60fps (~60s)       | Punchy social reel — story-driven props    |
| `ForgeIntro`   | 1920×1080                      | Cinematic intro                            |
| `ProblemStory` | 1080×1920                      | Problem narrative                          |

Use the **Props** panel in Studio to tweak `ForgePitch` / `ForgeReel` fields live (schema-backed).

## Single renders

Investor pitch (reads `stories/pitch-investor.json`):

```bash
npm run render:pitch
```

Hardcore BLACKOUT trailer (60s vertical @ 60fps):

```bash
npm run render:blackout
```

Default reel (hardcoded defaults — same as previous `render:reel`):

```bash
npm run render:reel
```

One story file explicitly:

```bash
npx remotion render ForgePitch out/pitch-investor.mp4 --props=stories/pitch-investor.json
npx remotion render ForgeReel out/reel-worker-plumber-accra.mp4 --props=stories/reel-worker-plumber-accra.json --image-format=png --video-bitrate=8M
```

Quick still (sanity check, ~1s into pitch):

```bash
npx remotion still ForgePitch --frame=30 --scale=0.25 --props=stories/pitch-investor.json
```

## Batch render (all stories)

```bash
npm run render:all
```

This runs `scripts/render-all.ps1`, which:

1. Reads every `stories/*.json`
2. Renders `type: "pitch"` → composition `ForgePitch`
3. Renders `type: "reel"` → composition `ForgeReel`
4. Writes `out/{id}.mp4` (e.g. `out/pitch-investor.mp4`)

Outputs land in `marketing/out/` (gitignored). Full batch takes a while — prefer stills / Studio while iterating.

## Edit story JSON

Stories live in `marketing/stories/`.

### Pitch (`type: "pitch"`)

Key fields in `pitch-investor.json`:

| Field           | Purpose                                      |
| --------------- | -------------------------------------------- |
| `hookLine1/2`   | Opening kinetic lines                        |
| `painLines`     | Problem act captions                         |
| `loopSteps`     | Discover → Hire → …                          |
| `tagline`       | Under FORGE wordmark                         |
| `askAmount`     | Raise amount (placeholder until you fill it) |
| `askUse`        | Use of funds                                 |
| `contactEmail`  | Contact on ask slide                         |
| `url`           | Live site                                    |
| `featureLabels` | Product panel titles                         |
| `marketChips`   | Differentiation chips (GHS, NGN, …)          |

**Fill before investor send:** replace `[YOUR AMOUNT]`, `[YOUR USE OF FUNDS]`, and `[YOUR EMAIL]`.

### Reel (`type: "reel"`)

| Field          | Purpose                                      |
| -------------- | -------------------------------------------- |
| `audience`     | `worker` or `customer` (metadata / targeting)|
| `painCaption`  | Kinetic pain line                            |
| `searchQuery`  | Typed search string                          |
| `workers[]`    | Name, trade, city, rating, tags, initials    |
| `bookWorker`   | Which worker is booked / chats               |
| `chatLine`     | Worker reply bubble                          |
| `tradesChips`  | Trade flash chips                            |
| `ctaUrl`       | CTA button URL                               |
| `jobLabel`     | Booking job label                            |
| `escrowLabel`  | Escrow amount string                         |

Add a new variant: copy an existing reel JSON, change `id` + fields, then re-run `npm run render:all` or a single `remotion render` with `--props=…`.

## Tips

- Do **not** commit huge MP4s from `out/`.
- Product act in ForgePitch has dashed **UI** placeholders — drop real screen recordings later if you want live app footage.
- Brand colors: `src/brand.ts` / ForgeReel `theme.ts`.
