import { forge } from "../../brand";

/**
 * Reel palette — high contrast, readable on phones.
 * Brighter surfaces + stronger borders so UI doesn't look muddy.
 */
export const reel = {
  bg: "#0A0A0A",
  navy: forge.navy,
  orange: forge.orange,
  ember: forge.ember,
  white: "#FFFFFF",
  soft: "#F5F5F5",
  muted: "rgba(255, 255, 255, 0.78)",
  dim: "rgba(255, 255, 255, 0.5)",
  glass: "rgba(255, 255, 255, 0.12)",
  glassBorder: "rgba(255, 255, 255, 0.28)",
  red: "#FF4D4F",
  gold: "#F5C542",
  green: forge.green,
  whatsapp: "#075E54",
  bubble: "#242426",
  screen: "#141414",
} as const;
