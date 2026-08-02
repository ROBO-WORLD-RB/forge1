import { forge } from "../../brand";

/** Hardcore trailer palette — ink black + brand orange, high contrast. */
export const blackout = {
  bg: "#050505",
  ink: forge.ink,
  orange: forge.orange,
  ember: forge.ember,
  spark: forge.spark,
  white: "#FFFFFF",
  soft: "#F2F2F2",
  muted: "rgba(255, 255, 255, 0.7)",
  dim: "rgba(255, 255, 255, 0.42)",
  red: "#FF2D2D",
  green: forge.green,
  glass: "rgba(255, 255, 255, 0.1)",
  glassBorder: "rgba(255, 255, 255, 0.22)",
  screen: "#121212",
  cityBlue: "#0A1628",
} as const;
