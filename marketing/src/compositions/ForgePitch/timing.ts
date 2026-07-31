import { VIDEO } from "../../brand";
import { linearTiming } from "@remotion/transitions";

export const FPS = VIDEO.fps;

/** Soft crossfade between pitch acts (~0.5s). */
export const fadeAct = linearTiming({ durationInFrames: 15 });

/**
 * Investor pitch ~2:10 at 30fps (within 75–150s band).
 * Act durations include room for VO / reading kinetic type.
 */
export const sceneDurations = {
  hook: 18 * FPS, // 18s
  problem: 24 * FPS, // 24s
  solution: 20 * FPS, // 20s
  product: 28 * FPS, // 28s
  diff: 16 * FPS, // 16s
  team: 12 * FPS, // 12s
  ask: 12 * FPS, // 12s
} as const;

const actIds = Object.keys(sceneDurations) as (keyof typeof sceneDurations)[];
const rawSum = actIds.reduce((n, id) => n + sceneDurations[id], 0);
const fadeFrames = fadeAct.getDurationInFrames({ fps: FPS });
/** TransitionSeries overlaps fades — subtract one fade per transition. */
export const DURATION_FRAMES = rawSum - fadeFrames * (actIds.length - 1);
export const DURATION_SECONDS = DURATION_FRAMES / FPS;
