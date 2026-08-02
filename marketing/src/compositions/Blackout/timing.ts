import { VIDEO_VERTICAL_60 } from "../../brand";

/**
 * BLACKOUT — 60s hardcore vertical trailer @ 60fps.
 * Night outage → melting stock → chaos calls → FORGE → lights on → end card.
 */
export const FPS = VIDEO_VERTICAL_60.fps;

/** Named acts in story order. Durations sum to exactly 3600f (60s). */
export const ACTS = [
  { id: "powerDies", duration: 480 }, // 0–8s
  { id: "meltingMoney", duration: 480 }, // 8–16s
  { id: "chaosCalls", duration: 720 }, // 16–28s
  { id: "forgeFlip", duration: 840 }, // 28–42s
  { id: "lightsOn", duration: 600 }, // 42–52s
  { id: "endCard", duration: 480 }, // 52–60s
] as const;

export type ActId = (typeof ACTS)[number]["id"];

let cursor = 0;
export const actTimeline = ACTS.map((a) => {
  const from = cursor;
  cursor += a.duration;
  return { ...a, from };
});

export const DURATION_FRAMES = cursor; // 3600
export const DURATION_SECONDS = DURATION_FRAMES / FPS;

if (DURATION_FRAMES !== FPS * 60) {
  throw new Error(
    `Blackout must be exactly 60s (${FPS * 60}f), got ${DURATION_FRAMES}f`,
  );
}

export function actRange(id: ActId): { from: number; duration: number } {
  const a = actTimeline.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown act ${id}`);
  return { from: a.from, duration: a.duration };
}
