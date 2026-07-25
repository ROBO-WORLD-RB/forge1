import { forge } from "../../brand";

/**
 * Reel palette — brand-aligned, high contrast on phones.
 * Avoid neon cyan glow; orange is the only hot accent.
 */
export const reel = {
  bg: forge.ink,
  navy: forge.navy,
  orange: forge.orange,
  ember: forge.ember,
  white: forge.white,
  soft: "rgba(255, 255, 255, 0.94)",
  muted: "rgba(255, 255, 255, 0.62)",
  dim: "rgba(255, 255, 255, 0.38)",
  glass: "rgba(255, 255, 255, 0.07)",
  glassBorder: "rgba(255, 255, 255, 0.16)",
  red: "#FF4D4F",
  gold: "#F5C542",
  green: forge.green,
  whatsapp: "#075E54",
  bubble: "#1C1C1E",
  screen: "#111111",
} as const;
