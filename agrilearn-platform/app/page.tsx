import Link from "next/link";

const features = [
  ["AI Farm Assistant", "Get practical guidance on crops, soil, pests, livestock, and farm planning."],
  ["Structured Learning", "Follow short, accessible agricultural courses and track your progress."],
  ["Local Knowledge", "Build recommendations around local crops, climates, languages, and realities."],
];

export default function HomePage() {
  return (
    <main>
      <header className="site-header container">
        <Link className="brand" href="/">AgriLearn <span>AI</span></Link>
        <nav className="header-actions">
          <Link className="text-link" href="/login">Sign in</Link>
          <Link className="button button-small" href="/register">Create account</Link>
        </nav>
      </header>

      <section className="hero container">
        <div>
          <p className="eyebrow">A World Humanitarian Support Foundation initiative</p>
          <h1>Practical agricultural knowledge, powered by responsible AI.</h1>
          <p className="hero-copy">AgriLearn AI helps farmers, students, extension workers, and communities learn, make informed decisions, and improve agricultural outcomes.</p>
          <div className="hero-actions">
            <Link className="button" href="/register">Start learning</Link>
            <Link className="button button-secondary" href="/login">Open dashboard</Link>
          </div>
        </div>
        <aside className="hero-panel">
          <span className="status-dot" />
          <p className="eyebrow">Ask AgriLearn</p>
          <h2>“What can I plant at the start of the rainy season?”</h2>
          <p>Receive clear recommendations, important safety notes, and questions that help tailor the guidance to your location and farm.</p>
        </aside>
      </section>

      <section className="section container">
        <div className="section-heading">
          <p className="eyebrow">One connected platform</p>
          <h2>Learn, ask, practice, and grow.</h2>
        </div>
        <div className="card-grid">
          {features.map(([title, description]) => (
            <article className="feature-card" key={title}>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer container">© {new Date().getFullYear()} World Humanitarian Support Foundation</footer>
    </main>
  );
}
