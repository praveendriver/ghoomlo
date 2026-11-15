import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Ghoomlo — trip plans that fit your family", template: "%s · Ghoomlo" },
  description:
    "Plan a trip around your family's dates, food, pace, and budget, and see clearly what still needs checking.",
};
export const viewport: Viewport = { themeColor: "#f4f1e9" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
