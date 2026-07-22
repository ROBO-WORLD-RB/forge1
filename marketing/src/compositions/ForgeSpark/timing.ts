import { VIDEO } from "../../brand";

/** Total runtime: 28s — tight trailer cold-open. */
export const FPS = VIDEO.fps;
export const DURATION_SECONDS = 28;
export const DURATION_FRAMES = DURATION_SECONDS * FPS;

/**
 * Scene windows (absolute frames). Overlaps create cinematic crossfades.
 *
 * 0–2.5s   Ember wakes in the dark
 * 2–7s     "Looking for hands?"
 * 6–11.5s  "Hands ready." — two sides of the marketplace
 * 10–16s   Spark draws the match between them
 * 14.5–21s Strike / forge letters from heat
 * 19–28s   Brand lockup + punchline hold
 */
export const scenes = {
  ember: { from: 0, duration: 90 },
  looking: { from: 60, duration: 150 },
  handsReady: { from: 180, duration: 165 },
  matchDraw: { from: 300, duration: 180 },
  strike: { from: 435, duration: 195 },
  lockup: { from: 570, duration: DURATION_FRAMES - 570 },
} as const;
