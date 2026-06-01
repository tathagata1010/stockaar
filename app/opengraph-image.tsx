import { ImageResponse } from "next/og";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

export const runtime = "edge";
export const alt = `${APP_NAME} — ${APP_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "linear-gradient(135deg, #0b1020 0%, #111a3a 45%, #1f2a5c 100%)",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#4f46e5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              fontWeight: 800,
            }}
          >
            स
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>
            {APP_NAME}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 68,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              maxWidth: 1000,
            }}
          >
            {APP_TAGLINE}
          </div>
          <div style={{ fontSize: 28, color: "#a3b1d6", maxWidth: 1000 }}>
            Live NSE & BSE prices · Scorecards · Screener · Hot stocks · AI briefs
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "#a3b1d6",
          }}
        >
          <div>stockaar.vercel.app</div>
          <div style={{ display: "flex", gap: 16 }}>
            <span style={{ color: "#22c55e" }}>● Nifty</span>
            <span style={{ color: "#22c55e" }}>● Sensex</span>
            <span style={{ color: "#22c55e" }}>● Bank Nifty</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
