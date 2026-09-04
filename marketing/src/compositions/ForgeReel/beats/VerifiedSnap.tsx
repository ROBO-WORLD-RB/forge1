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

export const VerifiedSnap = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const snap = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 220 },
  });
  const bump = interpolate(snap, [0, 0.55, 1], [0.4, 1.18, 1]);

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
            gap: 20,
            padding: 32,
          }}
        >
          <div
            style={{
              transform: `scale(${bump})`,
              width: 96,
              height: 96,
              borderRadius: "50%",
              background: reel.green,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 8px 28px rgba(0,166,81,0.45)`,
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 12.5l4 4L18 8"
                stroke="#04120a"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div
            style={{
              fontFamily: uiFont,
              fontWeight: 800,
              fontSize: 28,
              color: reel.white,
              opacity: interpolate(frame, [16, 32], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            Skills verified
          </div>
        </div>
      </PhoneShell>
    </AbsoluteFill>
  );
};
