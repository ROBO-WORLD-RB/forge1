import { Composition } from "remotion";
import { VIDEO_VERTICAL_60 } from "../../brand";
import { ForgeReel } from "./ForgeReel";
import { waitForFonts } from "./fonts";
import { DURATION_FRAMES } from "./timing";

export { ForgeReel } from "./ForgeReel";
export { DURATION_FRAMES, DURATION_SECONDS } from "./timing";

export const ForgeReelComposition: React.FC = () => {
  return (
    <Composition
      id="ForgeReel"
      component={ForgeReel}
      durationInFrames={DURATION_FRAMES}
      fps={VIDEO_VERTICAL_60.fps}
      width={VIDEO_VERTICAL_60.width}
      height={VIDEO_VERTICAL_60.height}
      calculateMetadata={async () => {
        await waitForFonts();
        return {};
      }}
    />
  );
};
