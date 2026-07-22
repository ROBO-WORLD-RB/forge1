import { loadFont as loadBebas } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadOutfit } from "@remotion/google-fonts/Outfit";

const bebas = loadBebas("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

const outfit = loadOutfit("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const displayFont = bebas.fontFamily;
export const bodyFont = outfit.fontFamily;
