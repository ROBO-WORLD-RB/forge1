/**
 * FORGE brand tokens — mirrored from the main app (tailwind.config.js).
 * Keep marketing videos visually consistent without importing the Vite app.
 */
export const forge = {
  navy: "#1A1A1A",
  orange: "#FF7A00",
  cyan: "#0891B2",
  green: "#00A651",
  white: "#FFFFFF",
  muted: "rgba(255, 255, 255, 0.72)",
} as const;

export const VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
} as const;
