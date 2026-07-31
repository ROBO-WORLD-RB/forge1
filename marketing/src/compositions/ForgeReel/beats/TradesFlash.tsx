import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { uiFont } from "../fonts";
import { useReelProps } from "../ReelPropsContext";
import { reel } from "../theme";

export const TradesFlash = () => {
  const { tradesChips } = useReelProps();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: reel.bg,
        justifyContent: "center",
        alignItems: "center",
        gap: 16,
        flexDirection: "column",
        padding: 40,
      }}
    >
      <div
        style={{
          fontFamily: uiFont,
          fontWeight: 700,
          fontSize: 18,
          color: reel.muted,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginBottom: 10,
          opacity: interpolate(frame, [0, 12], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        Hire any trade
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "center",
          maxWidth: 900,
        }}
      >
        {tradesChips.map((trade, i) => {
          const s = spring({
            frame: Math.max(0, frame - i * 18),
            fps,
            config: { damping: 12, stiffness: 190 },
          });
          return (
            <div
              key={trade}
              style={{
                padding: "14px 26px",
                borderRadius: 14,
                border: `2px solid ${reel.orange}`,
                background: "rgba(255,122,0,0.1)",
                fontFamily: uiFont,
                fontWeight: 800,
                fontSize: 28,
                color: reel.white,
                transform: `scale(${interpolate(s, [0, 1], [0.5, 1])})`,
                opacity: s,
              }}
            >
              {trade}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
