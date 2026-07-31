import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PhoneShell } from "../components/PhoneShell";
import { uiFont } from "../fonts";
import { useReelProps } from "../ReelPropsContext";
import { workerInitials, type ReelWorker } from "../schema";
import { reel } from "../theme";

/** In-app chat with booked worker — header + thread. */
export const ChatReply = () => {
  const { workers, bookWorker, chatLine } = useReelProps();
  const worker: ReelWorker =
    workers.find((w) => w.name === bookWorker) ??
    workers[workers.length - 1] ??
    {
      name: bookWorker,
      trade: "Pro",
      city: "Accra",
    };
  const firstName = worker.name.split(/\s+/)[0] ?? worker.name;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const typing = frame < 90;
  const bubble = spring({
    frame: Math.max(0, frame - 90),
    fps,
    config: { damping: 12, stiffness: 170 },
  });
  const enter = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 150 },
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
            background: "#E8E4DC",
            opacity: interpolate(enter, [0, 1], [0.85, 1]),
          }}
        >
          <div
            style={{
              padding: "54px 16px 14px",
              background: "#F7F5F1",
              borderBottom: "1px solid rgba(0,0,0,0.08)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: `linear-gradient(135deg, #1a3a4a, ${reel.orange})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: uiFont,
                fontWeight: 800,
                fontSize: 16,
                color: reel.white,
                flexShrink: 0,
              }}
            >
              {workerInitials(worker)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: uiFont,
                  fontWeight: 800,
                  fontSize: 17,
                  color: "#111111",
                }}
              >
                {worker.name}
              </div>
              <div
                style={{
                  fontFamily: uiFont,
                  fontWeight: 600,
                  fontSize: 12,
                  color: reel.green,
                  marginTop: 2,
                }}
              >
                Online · {worker.trade}
              </div>
            </div>
            <div
              style={{
                fontFamily: uiFont,
                fontWeight: 700,
                fontSize: 11,
                color: "#111111",
                background: "rgba(0,166,81,0.15)",
                border: `1px solid rgba(0,166,81,0.35)`,
                borderRadius: 999,
                padding: "5px 10px",
              }}
            >
              Booked
            </div>
          </div>

          <div
            style={{
              flex: 1,
              padding: "18px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              justifyContent: "flex-end",
            }}
          >
            <div
              style={{
                alignSelf: "center",
                fontFamily: uiFont,
                fontWeight: 600,
                fontSize: 11,
                color: "rgba(0,0,0,0.45)",
                background: "rgba(255,255,255,0.7)",
                borderRadius: 999,
                padding: "4px 12px",
              }}
            >
              Today · Booking confirmed
            </div>

            <div
              style={{
                alignSelf: "flex-end",
                background: reel.orange,
                borderRadius: "18px 18px 4px 18px",
                padding: "12px 14px",
                maxWidth: "78%",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              <div
                style={{
                  fontFamily: uiFont,
                  fontWeight: 600,
                  fontSize: 16,
                  color: reel.white,
                  lineHeight: 1.35,
                }}
              >
                Can you come today?
              </div>
              <div
                style={{
                  fontFamily: uiFont,
                  fontWeight: 600,
                  fontSize: 10,
                  color: "rgba(255,255,255,0.75)",
                  textAlign: "right",
                  marginTop: 6,
                }}
              >
                2:14 PM
              </div>
            </div>

            {typing ? (
              <div
                style={{
                  alignSelf: "flex-start",
                  background: "#FFFFFF",
                  borderRadius: "18px 18px 18px 4px",
                  padding: "14px 18px",
                  display: "flex",
                  gap: 6,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#888",
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
                  alignSelf: "flex-start",
                  background: "#FFFFFF",
                  borderRadius: "18px 18px 18px 4px",
                  padding: "12px 14px",
                  maxWidth: "82%",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  transform: `scale(${interpolate(bubble, [0, 1], [0.85, 1])})`,
                  opacity: bubble,
                  transformOrigin: "bottom left",
                }}
              >
                <div
                  style={{
                    fontFamily: uiFont,
                    fontWeight: 700,
                    fontSize: 16,
                    color: "#111111",
                    lineHeight: 1.35,
                  }}
                >
                  {chatLine}
                </div>
                <div
                  style={{
                    fontFamily: uiFont,
                    fontWeight: 600,
                    fontSize: 10,
                    color: "rgba(0,0,0,0.4)",
                    marginTop: 6,
                  }}
                >
                  2:15 PM
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              padding: "10px 12px 28px",
              background: "#F7F5F1",
              borderTop: "1px solid rgba(0,0,0,0.08)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                flex: 1,
                background: "#FFFFFF",
                border: "1px solid rgba(0,0,0,0.1)",
                borderRadius: 22,
                padding: "12px 16px",
                fontFamily: uiFont,
                fontWeight: 600,
                fontSize: 14,
                color: "rgba(0,0,0,0.35)",
              }}
            >
              Message {firstName}…
            </div>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                background: reel.orange,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 12l16-8-6 18-2.5-7.5L4 12z"
                  fill="#fff"
                />
              </svg>
            </div>
          </div>
        </div>
      </PhoneShell>
    </AbsoluteFill>
  );
};
