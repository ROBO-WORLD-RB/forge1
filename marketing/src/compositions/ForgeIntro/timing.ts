import { VIDEO } from "../../brand";
import { linearTiming } from "@remotion/transitions";

/** Total runtime: 60s — questions → silence → answer. */
export const FPS = VIDEO.fps;
export const DURATION_SECONDS = 60;
export const DURATION_FRAMES = DURATION_SECONDS * FPS; // 1800

/**
 * Scene lengths (before transition overlap).
 *
 * TransitionSeries shortens the timeline by each transition duration:
 *   sum(scenes) − sum(transitions) = 1940 − 140 = 1800
 *
 * ~0–40s   Five questions that need an answer
 * ~40–50s  Breath / “You need an answer.”
 * ~50–60s  FORGE reveal + punchline
 */
export const sceneDurations = {
  q1: 260,
  q2: 250,
  q3: 250,
  q4: 250,
  q5: 260,
  need: 330,
  brand: 340,
} as const;

export const fadeSoft = linearTiming({ durationInFrames: 20 });
export const fadeHold = linearTiming({ durationInFrames: 28 });
export const fadeBrand = linearTiming({ durationInFrames: 32 });

const transitionFrames =
  fadeSoft.getDurationInFrames({ fps: FPS }) * 4 +
  fadeHold.getDurationInFrames({ fps: FPS }) +
  fadeBrand.getDurationInFrames({ fps: FPS });

const sceneSum = Object.values(sceneDurations).reduce((a, b) => a + b, 0);

/** Sanity: composition length must stay exactly 60s. */
export const COMPUTED_DURATION = sceneSum - transitionFrames;

if (COMPUTED_DURATION !== DURATION_FRAMES) {
  throw new Error(
    `ForgeIntro duration mismatch: computed ${COMPUTED_DURATION}, expected ${DURATION_FRAMES}`,
  );
}
