import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/fraunces/wght-italic.css";
import "@fontsource-variable/dm-sans";
import "@fontsource/caveat/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Ghoomlo — trip plans that fit your family", template: "%s · Ghoomlo" },
  description:
    "Plan a trip around your family's dates, food, pace, and budget, and see clearly what still needs checking.",
};
export const viewport: Viewport = { themeColor: "#15211c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
