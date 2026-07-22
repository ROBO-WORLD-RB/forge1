import "./index.css";
import { BrandIntroComposition } from "./BrandIntro";
import { ForgeIntroComposition } from "./compositions/ForgeIntro";
import { HelloForgeComposition } from "./HelloForge";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <ForgeIntroComposition />
      <HelloForgeComposition />
      <BrandIntroComposition />
    </>
  );
};
