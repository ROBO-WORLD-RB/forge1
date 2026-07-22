import { Composition } from "remotion";
import { VIDEO } from "../../brand";
import { ForgeSpark } from "./ForgeSpark";
import { DURATION_FRAMES } from "./timing";

export { ForgeSpark } from "./ForgeSpark";
export { DURATION_FRAMES, DURATION_SECONDS } from "./timing";

export const ForgeSparkComposition: React.FC = () => {
  return (
    <Composition
      id="ForgeSpark"
      component={ForgeSpark}
      durationInFrames={DURATION_FRAMES}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
  );
};
