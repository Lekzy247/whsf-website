import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "@whsf/aurora-ui/styles.css";
import "./styles.css";
import { AppProviders } from "./providers";

const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const display = Manrope({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: { default: "WHSF Humanitarian Platform", template: "%s · WHSF" },
  description: "Coordinate humanitarian programmes, evidence, and field operations responsibly.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${body.variable} ${display.variable}`}>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
