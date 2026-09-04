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

/** Interactive escrow toggle / lock. */
export const EscrowLock = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame,
    fps,
    config: { damping: 13, stiffness: 150 },
  });
  const locked = frame >= 90;
  const toggle = spring({
    frame: Math.max(0, frame - 90),
    fps,
    config: { damping: 14, stiffness: 200 },
  });
  const finger = spring({
    frame: Math.max(0, frame - 60),
    fps,
    config: { damping: 16, stiffness: 180 },
  });

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
            padding: 32,
            gap: 22,
            transform: `scale(${interpolate(enter, [0, 1], [0.9, 1])})`,
          }}
        >
          <div
            style={{
              fontFamily: uiFont,
              fontWeight: 800,
              fontSize: 26,
              color: reel.white,
            }}
          >
            Secure payment
          </div>
          <div
            style={{
              background: reel.glass,
              border: `1px solid ${reel.glassBorder}`,
              borderRadius: 18,
              padding: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              position: "relative",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: uiFont,
                  fontWeight: 700,
                  fontSize: 18,
                  color: reel.white,
                }}
              >
                Paystack Escrow
              </div>
              <div
                style={{
                  fontFamily: uiFont,
                  fontWeight: 600,
                  fontSize: 14,
                  color: locked ? reel.green : reel.muted,
                  marginTop: 4,
                }}
              >
                {locked ? "Funds locked until done" : "Tap to protect payment"}
              </div>
            </div>
            <div
              style={{
                width: 56,
                height: 32,
                borderRadius: 999,
                background: locked ? reel.green : "#333",
                padding: 3,
                position: "relative",
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: reel.white,
                  transform: `translateX(${interpolate(toggle, [0, 1], [0, 24])}px)`,
                }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                right: 8,
                bottom: -8,
                width: 34,
                height: 34,
                borderRadius: "50%",
                border: `3px solid ${reel.white}`,
                background: "rgba(255,255,255,0.2)",
                transform: `translate(${interpolate(finger, [0, 1], [40, 0])}px, ${interpolate(finger, [0, 1], [30, 0])}px)`,
                opacity: interpolate(frame, [45, 70, 110, 140], [0, 1, 1, 0], {
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
