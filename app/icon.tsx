import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 300, height: 400, background: "#f6f2e9", borderRadius: 24, display: "flex", flexDirection: "column", justifyContent: "space-around", alignItems: "center", padding: 20 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 220, height: 90, background: ["#2a2724", "#4a4540", "#6e1215"][i], borderRadius: 8 }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
