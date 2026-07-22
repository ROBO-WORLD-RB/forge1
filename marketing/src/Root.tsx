import "./index.css";
import { BrandIntroComposition } from "./BrandIntro";
import { ForgeSparkComposition } from "./compositions/ForgeSpark";
import { HelloForgeComposition } from "./HelloForge";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <ForgeSparkComposition />
      <HelloForgeComposition />
      <BrandIntroComposition />
    </>
  );
};
