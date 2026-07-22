import { VIDEO } from "../../brand";
import { linearTiming } from "@remotion/transitions";

/** Total runtime: ~66s — questions → silence → answer → closing credit. */
export const FPS = VIDEO.fps;
export const DURATION_SECONDS = 66;
export const DURATION_FRAMES = DURATION_SECONDS * FPS; // 1980

/** AI Studio full narration (~50.1s). Plays from frame 0; end card holds in silence after VO ends. */
export const NARRATION_AUDIO = "audio/forge-intro-narration-full.wav" as const;

/**
 * Scene lengths (before transition overlap).
 *
 * TransitionSeries shortens the timeline by each transition duration:
 *   sum(scenes) − sum(transitions) = 2144 − 164 = 1980
 *
 * ~0–40s   Five questions that need an answer
 * ~40–50s  Breath / “You need an answer.”
 * ~50–59s  FORGE reveal + punchline
 * ~59–66s  Closing end card
 */
export const sceneDurations = {
  q1: 260,
  q2: 250,
  q3: 250,
  q4: 250,
  q5: 260,
  need: 330,
  brand: 340,
  end: 204,
} as const;

export const fadeSoft = linearTiming({ durationInFrames: 20 });
export const fadeHold = linearTiming({ durationInFrames: 28 });
export const fadeBrand = linearTiming({ durationInFrames: 32 });
export const fadeEnd = linearTiming({ durationInFrames: 24 });

const transitionFrames =
  fadeSoft.getDurationInFrames({ fps: FPS }) * 4 +
  fadeHold.getDurationInFrames({ fps: FPS }) +
  fadeBrand.getDurationInFrames({ fps: FPS }) +
  fadeEnd.getDurationInFrames({ fps: FPS });

const sceneSum = Object.values(sceneDurations).reduce((a, b) => a + b, 0);

/** Sanity: composition length must stay exactly on target. */
export const COMPUTED_DURATION = sceneSum - transitionFrames;

if (COMPUTED_DURATION !== DURATION_FRAMES) {
  throw new Error(
    `ForgeIntro duration mismatch: computed ${COMPUTED_DURATION}, expected ${DURATION_FRAMES}`,
  );
}
