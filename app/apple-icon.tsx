import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 106, height: 140, background: "#f6f2e9", borderRadius: 9, display: "flex", flexDirection: "column", justifyContent: "space-around", alignItems: "center", padding: 7 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 78, height: 31, background: ["#2a2724", "#4a4540", "#6e1215"][i], borderRadius: 3 }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
