import { ImageResponse } from "next/og";

export const alt = "Sana — calm cycle tracking in Telegram";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background:
            "linear-gradient(135deg, #EDE9FB 0%, #FFFFFF 60%, #F5F3FB 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #8B7FD6, #6B5FB8)",
            }}
          />
          <div
            style={{
              fontSize: 40,
              fontWeight: 500,
              color: "#1A1A1F",
              letterSpacing: "-0.02em",
            }}
          >
            Sana
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 88,
              fontWeight: 300,
              color: "#1A1A1F",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              maxWidth: 900,
            }}
          >
            Cycle tracking, quietly done.
          </div>
          <div
            style={{
              fontSize: 32,
              color: "#6B6B73",
              fontWeight: 300,
              maxWidth: 800,
            }}
          >
            Lavender calm, right inside Telegram.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 24, color: "#A0A0A8" }}>sanacycle.com</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 24px",
              borderRadius: 999,
              background: "#8B7FD6",
              color: "#fff",
              fontSize: 22,
            }}
          >
            Open in Telegram →
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
