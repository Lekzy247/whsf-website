import type { Metadata } from "next";
import "./styles.css";
export const metadata: Metadata = { title: "WHSF Platform Documentation" };
export default function DocsLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
