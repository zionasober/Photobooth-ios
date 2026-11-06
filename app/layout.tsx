import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Inter_Tight, Caveat } from "next/font/google";
import "./globals.css";

const serif = Bodoni_Moda({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-serif", display: "swap" });
const sans = Inter_Tight({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const hand = Caveat({ subsets: ["latin"], variable: "--font-hand", display: "swap" });

export const metadata: Metadata = {
  title: "Photobooth / NYC",
  description: "Four frames. No second takes.",
  appleWebApp: { capable: true, title: "Photobooth", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0e0d0c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${hand.variable}`}>
      <body>{children}</body>
    </html>
  );
}
