import { VIDEO_VERTICAL_60 } from "../../brand";

/** 45s @ 60fps — under the 1-minute cap. */
export const FPS = VIDEO_VERTICAL_60.fps;
export const DURATION_SECONDS = 45;
export const DURATION_FRAMES = DURATION_SECONDS * FPS; // 2700

export const scenes = {
  friction: { from: 0, duration: 720 },
  digital: { from: 720, duration: 1080 },
  resolve: { from: 1800, duration: 900 },
} as const;

const sum =
  scenes.friction.duration + scenes.digital.duration + scenes.resolve.duration;

if (sum !== DURATION_FRAMES) {
  throw new Error(
    `ForgeReel duration mismatch: scene sum ${sum}, expected ${DURATION_FRAMES}`,
  );
}

if (scenes.digital.from !== scenes.friction.from + scenes.friction.duration) {
  throw new Error("ForgeReel: digital scene start must follow friction");
}

if (scenes.resolve.from !== scenes.digital.from + scenes.digital.duration) {
  throw new Error("ForgeReel: resolve scene start must follow digital");
}
