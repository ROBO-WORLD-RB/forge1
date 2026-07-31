import "./index.css";
import { BrandIntroComposition } from "./BrandIntro";
import { ForgeIntroComposition } from "./compositions/ForgeIntro";
import { ForgePitchComposition } from "./compositions/ForgePitch";
import { ForgeReelComposition } from "./compositions/ForgeReel";
import { HelloForgeComposition } from "./HelloForge";
import { ProblemStoryComposition } from "./compositions/ProblemStory";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <ForgePitchComposition />
      <ForgeReelComposition />
      <ForgeIntroComposition />
      <ProblemStoryComposition />
      <HelloForgeComposition />
      <BrandIntroComposition />
    </>
  );
};
