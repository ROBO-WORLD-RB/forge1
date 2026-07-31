import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { forge } from "../../../brand";
import { Atmosphere } from "../../../shared/Atmosphere";
import { FilmGrain } from "../../../shared/FilmGrain";
import { bodyFont, displayFont } from "../../../shared/fonts";

type AskActProps = {
  askAmount: string;
  askUse: string;
  url: string;
  contactEmail: string;
};

/** Act 7 — raise ask + contact. */
export const AskAct: React.FC<AskActProps> = ({
  askAmount,
  askUse,
  url,
  contactEmail,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame,
    fps,
    config: { damping: 13, stiffness: 140 },
  });
  const pulse = interpolate(frame % 40, [0, 20, 40], [0.97, 1, 0.97]);

  return (
    <AbsoluteFill style={{ backgroundColor: forge.navy }}>
      <Atmosphere glowX={48} glowY={62} intensity={0.11} />
      <FilmGrain opacity={0.035} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          gap: 28,
          padding: "0 100px",
        }}
      >
        <div
          style={{
            fontFamily: displayFont,
            fontSize: 64,
            color: forge.orange,
            letterSpacing: "0.08em",
            opacity: enter,
          }}
        >
          FORGE
        </div>
        <div
          style={{
            fontFamily: bodyFont,
            fontWeight: 700,
            fontSize: 42,
            color: forge.white,
            textAlign: "center",
            lineHeight: 1.35,
            maxWidth: 1400,
            opacity: interpolate(frame, [16, 36], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          Raising {askAmount} for {askUse}
        </div>
        <div
          style={{
            transform: `scale(${enter * pulse})`,
            marginTop: 12,
            padding: "18px 40px",
            borderRadius: 14,
            background: forge.orange,
            color: forge.white,
            fontFamily: bodyFont,
            fontWeight: 800,
            fontSize: 28,
          }}
        >
          {url}
        </div>
        <div
          style={{
            fontFamily: bodyFont,
            fontWeight: 600,
            fontSize: 24,
            color: forge.muted,
            marginTop: 8,
            opacity: interpolate(frame, [50, 75], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          {contactEmail}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
