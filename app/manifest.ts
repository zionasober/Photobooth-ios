import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Photobooth NYC",
    short_name: "Photobooth NYC",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0e0d0c",
    theme_color: "#0e0d0c",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
