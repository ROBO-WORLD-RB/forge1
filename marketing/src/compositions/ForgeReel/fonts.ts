import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadOutfit } from "@remotion/google-fonts/Outfit";

const montserrat = loadMontserrat("normal", {
  weights: ["600", "700", "800", "900"],
  subsets: ["latin"],
});

const outfit = loadOutfit("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const displayFont = montserrat.fontFamily;
export const uiFont = outfit.fontFamily;

export const waitForFonts = () =>
  Promise.all([montserrat.waitUntilDone(), outfit.waitUntilDone()]);
