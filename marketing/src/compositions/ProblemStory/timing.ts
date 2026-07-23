import { VIDEO_VERTICAL } from "../../brand";
import { linearTiming } from "@remotion/transitions";

/** Total runtime: 30s vertical — problem beats → FORGE tease. */
export const FPS = VIDEO_VERTICAL.fps;
export const DURATION_SECONDS = 30;
export const DURATION_FRAMES = DURATION_SECONDS * FPS; // 900

/**
 * Scene lengths (before transition overlap).
 *
 * TransitionSeries shortens the timeline by each transition duration:
 *   sum(scenes) − sum(transitions) = 972 − 72 = 900
 */
export const sceneDurations = {
  pipe: 190,
  rain: 190,
  trust: 190,
  hands: 190,
  tease: 212,
} as const;

export const fadeBeat = linearTiming({ durationInFrames: 18 });

const transitionFrames = fadeBeat.getDurationInFrames({ fps: FPS }) * 4;
const sceneSum = Object.values(sceneDurations).reduce((a, b) => a + b, 0);

/** Sanity: composition length must stay exactly on target. */
export const COMPUTED_DURATION = sceneSum - transitionFrames;

if (COMPUTED_DURATION !== DURATION_FRAMES) {
  throw new Error(
    `ProblemStory duration mismatch: computed ${COMPUTED_DURATION}, expected ${DURATION_FRAMES}`,
  );
}
