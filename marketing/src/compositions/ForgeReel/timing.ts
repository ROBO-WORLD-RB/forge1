import { VIDEO_VERTICAL_60 } from "../../brand";

/**
 * Kinetic reel — every beat = 4.0s (240f @ 60fps).
 * Story: WhatsApp chaos → FORGE search/swipe/book → CTA → credit.
 */
export const FPS = VIDEO_VERTICAL_60.fps;
export const BEAT_FRAMES = 240; // 4.0s per beat
export const MAX_BEAT_FRAMES = BEAT_FRAMES;

/** Bed / score for ForgeReel — lives in marketing/public/audio/ */
export const REEL_AUDIO = "audio/forge-reel.wav" as const;

/** Named beats in order. Each duration must be ≤ MAX_BEAT_FRAMES. */
export const BEATS = [
  { id: "chatSlam", duration: BEAT_FRAMES }, // WhatsApp pile-up
  { id: "captionPain", duration: BEAT_FRAMES }, // Ghosted. Overcharged. No-shows.
  { id: "glitch", duration: 48 }, // 0.8s — snappy wipe into Meet FORGE
  { id: "meetForge", duration: BEAT_FRAMES }, // Meet FORGE.
  { id: "searchType", duration: BEAT_FRAMES }, // type + search
  { id: "swipeMatch", duration: BEAT_FRAMES }, // swipe worker card
  { id: "profileReveal", duration: BEAT_FRAMES }, // Kofi + Jerry
  { id: "verifiedSnap", duration: BEAT_FRAMES }, // verified badge
  { id: "starsPop", duration: BEAT_FRAMES }, // rating pop
  { id: "escrowLock", duration: BEAT_FRAMES }, // escrow lock tap
  { id: "bookTap", duration: BEAT_FRAMES }, // Book Now tap
  { id: "chatReply", duration: BEAT_FRAMES }, // On my way
  { id: "tradesFlash", duration: BEAT_FRAMES }, // trade chips
  { id: "cta", duration: BEAT_FRAMES }, // FORGE + URL
  { id: "closing", duration: BEAT_FRAMES }, // Built by Intelligent Systems
] as const;

export type BeatId = (typeof BEATS)[number]["id"];

let cursor = 0;
export const beatTimeline = BEATS.map((b) => {
  if (b.duration > MAX_BEAT_FRAMES) {
    throw new Error(`Beat ${b.id} exceeds 4s cap (${b.duration}f)`);
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
