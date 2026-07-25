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

/** Finger tap on Book Now. */
export const BookTap = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const btn = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 140 },
  });
  const tap = spring({
    frame: Math.max(0, frame - 90),
    fps,
    config: { damping: 16, stiffness: 210 },
  });
  const press = interpolate(frame, [90, 105, 130], [1, 0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ripple = interpolate(frame, [100, 180], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const confirmed = frame > 150;

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
            justifyContent: "flex-end",
            padding: 28,
            paddingBottom: 48,
          }}
        >
          <div style={{ position: "relative" }}>
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 160 * ripple,
                height: 160 * ripple,
                marginLeft: -80 * ripple,
                marginTop: -80 * ripple,
                borderRadius: "50%",
                border: `2px solid ${reel.orange}`,
                opacity: 1 - ripple,
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                transform: `scale(${interpolate(btn, [0, 1], [0.9, 1]) * press})`,
                background: confirmed ? reel.green : reel.orange,
                borderRadius: 18,
                padding: "22px 0",
                textAlign: "center",
                fontFamily: uiFont,
                fontWeight: 800,
                fontSize: 26,
                color: reel.white,
                boxShadow: confirmed
                  ? "0 8px 28px rgba(0,166,81,0.4)"
                  : "0 8px 28px rgba(255,122,0,0.4)",
              }}
            >
              {confirmed ? "Booked ✓" : "Book Now"}
            </div>
            <div
              style={{
                position: "absolute",
                right: 48,
                bottom: 8,
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: `3px solid ${reel.white}`,
                background: "rgba(255,255,255,0.25)",
                transform: `translate(${interpolate(tap, [0, 1], [48, 0])}px, ${interpolate(tap, [0, 1], [48, 0])}px) scale(${interpolate(tap, [0, 1], [0.5, 1])})`,
                opacity: interpolate(frame, [55, 90, 130, 160], [0, 1, 1, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            />
          </div>
        </div>
      </PhoneShell>
    </AbsoluteFill>
  );
};
