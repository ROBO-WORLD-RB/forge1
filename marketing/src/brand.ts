/**
 * FORGE brand tokens — mirrored from the main app (tailwind.config.js).
 * Keep marketing videos visually consistent without importing the Vite app.
 */
export const forge = {
  navy: "#1A1A1A",
  orange: "#FF7A00",
  /** Warm metal highlights for soft atmospheric glows */
  ember: "#FFB347",
  spark: "#FFE0A3",
  cyan: "#0891B2",
  green: "#00A651",
  white: "#FFFFFF",
  muted: "rgba(255, 255, 255, 0.72)",
  ink: "#0E0E0E",
} as const;

export const VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
} as const;

export const VIDEO_VERTICAL = {
  width: 1080,
  height: 1920,
  fps: 30,
} as const;
