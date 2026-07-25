import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PhoneShell } from "../components/PhoneShell";
import { uiFont } from "../fonts";
import { reel } from "../theme";

export const StarsPop = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: reel.bg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <PhoneShell>
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            {Array.from({ length: 5 }).map((_, i) => {
              const s = spring({
                frame: Math.max(0, frame - i * 22),
                fps,
                config: { damping: 10, stiffness: 240 },
              });
              return (
                <svg
                  key={i}
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  style={{
                    transform: `scale(${interpolate(s, [0, 1], [0, 1])}) rotate(${interpolate(s, [0, 1], [-18, 0])}deg)`,
                  }}
                >
                  <path
                    d="M12 2l2.9 6.9L22 10l-5 4.6L18.2 22 12 18.2 5.8 22 7 14.6 2 10l7.1-1.1L12 2z"
                    fill={reel.gold}
                  />
                </svg>
              );
            })}
          </div>
          <div
            style={{
              fontFamily: uiFont,
              fontWeight: 700,
              fontSize: 22,
              color: reel.soft,
            }}
          >
            128 jobs · 4.9 rating
          </div>
        </div>
      </PhoneShell>
    </AbsoluteFill>
  );
};
