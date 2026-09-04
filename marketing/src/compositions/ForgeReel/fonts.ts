import { loadFont as loadBebas } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadOutfit } from "@remotion/google-fonts/Outfit";

/** Display — bold condensed slam for FORGE / punch lines. */
const bebas = loadBebas("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

/** UI / captions — same body face as ForgeIntro (Outfit). */
const outfit = loadOutfit("normal", {
  weights: ["500", "600", "700", "800"],
  subsets: ["latin"],
});

export const displayFont = bebas.fontFamily;
export const uiFont = outfit.fontFamily;

export const waitForFonts = () =>
  Promise.all([bebas.waitUntilDone(), outfit.waitUntilDone()]);
