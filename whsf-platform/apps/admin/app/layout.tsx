import type { Metadata } from "next";
import "@whsf/aurora-ui/styles.css";
import "./styles.css";

export const metadata: Metadata = { title: "Operations · WHSF", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
