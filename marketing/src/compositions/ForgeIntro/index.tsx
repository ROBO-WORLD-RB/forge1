import { Composition } from "remotion";
import { VIDEO } from "../../brand";
import { ForgeIntro } from "./ForgeIntro";
import { waitForFonts } from "./fonts";
import { DURATION_FRAMES } from "./timing";

export { ForgeIntro } from "./ForgeIntro";
export { DURATION_FRAMES, DURATION_SECONDS } from "./timing";

export const ForgeIntroComposition: React.FC = () => {
  return (
    <Composition
      id="ForgeIntro"
      component={ForgeIntro}
      durationInFrames={DURATION_FRAMES}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      calculateMetadata={async () => {
        await waitForFonts();
        return {};
      }}
    />
  );
};
