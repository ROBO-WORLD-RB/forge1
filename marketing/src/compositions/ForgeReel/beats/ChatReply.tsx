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

export const ChatReply = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const typing = frame < 35;
  const bubble = spring({
    frame: Math.max(0, frame - 35),
    fps,
    config: { damping: 12, stiffness: 170 },
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
            justifyContent: "flex-end",
            padding: 28,
            gap: 14,
          }}
        >
          <div
            style={{
              alignSelf: "flex-start",
              background: reel.bubble,
              borderRadius: 18,
              padding: "14px 18px",
              fontFamily: uiFont,
              fontWeight: 600,
              fontSize: 18,
              color: reel.soft,
              maxWidth: "80%",
            }}
          >
            Can you come today?
          </div>

          {typing ? (
            <div
              style={{
                alignSelf: "flex-end",
                background: "#2a2a2a",
                borderRadius: 18,
                padding: "14px 20px",
                display: "flex",
                gap: 6,
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: reel.orange,
                    opacity: interpolate(
                      (frame + i * 6) % 24,
                      [0, 12, 24],
                      [0.3, 1, 0.3],
                    ),
                  }}
                />
              ))}
            </div>
          ) : (
            <div
              style={{
                alignSelf: "flex-end",
                background: reel.orange,
                borderRadius: 18,
                padding: "14px 18px",
                fontFamily: uiFont,
                fontWeight: 700,
                fontSize: 20,
                color: reel.white,
                maxWidth: "85%",
                transform: `scale(${interpolate(bubble, [0, 1], [0.7, 1])})`,
                opacity: bubble,
              }}
            >
              On my way — 25 mins.
            </div>
          )}
        </div>
      </PhoneShell>
    </AbsoluteFill>
  );
};
