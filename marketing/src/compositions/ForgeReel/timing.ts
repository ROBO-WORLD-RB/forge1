import { VIDEO_VERTICAL_60 } from "../../brand";

/**
 * Punchy kinetic reel — every beat ≤ 2.0s (120f @ 60fps).
 * Story: WhatsApp chaos → FORGE search/swipe/book → confirmed → brand.
 */
export const FPS = VIDEO_VERTICAL_60.fps;
export const MAX_BEAT_FRAMES = 120; // 2.0s hard cap

/** Named beats in order. Each duration must be ≤ MAX_BEAT_FRAMES. */
export const BEATS = [
  { id: "chatSlam", duration: 90 }, // 1.5s — frantic WhatsApp pile-up
  { id: "captionPain", duration: 90 }, // 1.5s — Ghosted. Overcharged. No-shows.
  { id: "glitch", duration: 60 }, // 1.0s — hard cut
  { id: "meetForge", duration: 75 }, // 1.25s — Meet FORGE.
  { id: "searchType", duration: 105 }, // 1.75s — type + search (interactive)
  { id: "swipeMatch", duration: 105 }, // 1.75s — swipe worker card
  { id: "profileReveal", duration: 90 }, // 1.5s — name + trade
  { id: "verifiedSnap", duration: 75 }, // 1.25s — verified badge
  { id: "starsPop", duration: 90 }, // 1.5s — rating pop
  { id: "escrowLock", duration: 90 }, // 1.5s — escrow lock tap
  { id: "bookTap", duration: 105 }, // 1.75s — Book Now tap
  { id: "chatReply", duration: 90 }, // 1.5s — On my way
  { id: "tradesFlash", duration: 90 }, // 1.5s — trade chips
  { id: "logoSlam", duration: 90 }, // 1.5s — FORGE
  { id: "cta", duration: 120 }, // 2.0s — CTA
] as const;

export type BeatId = (typeof BEATS)[number]["id"];

let cursor = 0;
export const beatTimeline = BEATS.map((b) => {
  if (b.duration > MAX_BEAT_FRAMES) {
    throw new Error(`Beat ${b.id} exceeds 2s cap (${b.duration}f)`);
  }
  const from = cursor;
  cursor += b.duration;
  return { ...b, from };
});

export const DURATION_FRAMES = cursor;
export const DURATION_SECONDS = DURATION_FRAMES / FPS;

export function beatRange(id: BeatId): { from: number; duration: number } {
  const b = beatTimeline.find((x) => x.id === id);
  if (!b) throw new Error(`Unknown beat ${id}`);
  return { from: b.from, duration: b.duration };
}
