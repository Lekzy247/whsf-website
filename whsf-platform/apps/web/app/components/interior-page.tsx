import Link from "next/link";

interface InteriorPageProps {
  eyebrow: string;
  title: string;
  introduction: string;
  children: React.ReactNode;
}

export function InteriorPage({ eyebrow, title, introduction, children }: InteriorPageProps) {
  return (
    <main id="main-content" className="interior">
      <Link className="back-link" href="/">← WHSF home</Link>
      <header>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="interior-lede">{introduction}</p>
      </header>
      <section className="interior-content">{children}</section>
    </main>
  );
}
