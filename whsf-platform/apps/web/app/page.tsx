import Link from "next/link";
import { Card } from "@whsf/aurora-ui";
import { navigationItems } from "@whsf/shared";

const priorities = [
  { value: "12", label: "Active responses", note: "Across food security, health, and protection" },
  { value: "84K", label: "People supported", note: "Verified reach in the current reporting period" },
  { value: "93%", label: "Funds to programmes", note: "Transparent, programme-linked expenditure" },
];

export default function HomePage() {
  return (
    <>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="WHSF platform home">
          <span className="brand-mark" aria-hidden="true">W</span>
          <span>World Humanitarian<br />Support Foundation</span>
        </Link>
        <nav aria-label="Primary navigation">
          <ul>{navigationItems.map((item) => <li key={item.href}><Link href={item.href}>{item.label}</Link></li>)}</ul>
        </nav>
        <Link className="portal-link" href="/portal">Partner portal <span aria-hidden="true">↗</span></Link>
      </header>

      <main id="main-content">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow"><span /> Coordinated humanitarian action</p>
            <h1>Evidence that moves<br /><em>help forward.</em></h1>
            <p className="hero-lede">A trusted operating platform for communities, partners, and field teams to turn resources into accountable, measurable impact.</p>
            <div className="hero-actions">
              <Link className="primary-link" href="/programmes">Explore our programmes <span aria-hidden="true">→</span></Link>
              <Link className="text-link" href="/impact">View impact evidence</Link>
            </div>
          </div>
          <div className="hero-panel" aria-label="Current operational brief">
            <span className="panel-kicker">Operational brief · live</span>
            <h2>One shared picture for every response.</h2>
            <p>Field observations, programme delivery, risk signals, and funding accountability connected in one secure workspace.</p>
            <div className="signal-row"><span>Food security</span><strong>4 responses</strong></div>
            <div className="signal-row"><span>Community health</span><strong>5 responses</strong></div>
            <div className="signal-row"><span>Protection</span><strong>3 responses</strong></div>
          </div>
        </section>

        <section className="metrics" aria-labelledby="metrics-title">
          <div className="section-heading">
            <p className="eyebrow">Current reporting period</p>
            <h2 id="metrics-title">A clear line from commitment to impact.</h2>
          </div>
          <div className="metric-grid">
            {priorities.map((priority) => (
              <Card className="metric-card" key={priority.label}>
                <strong>{priority.value}</strong>
                <h3>{priority.label}</h3>
                <p>{priority.note}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="principles">
          <div><p className="eyebrow">Built for responsible scale</p><h2>Human dignity is a system requirement.</h2></div>
          <div className="principle-list">
            <p><span>01</span><strong>Community-led by default</strong><small>Programmes begin with local priorities and preserve meaningful consent.</small></p>
            <p><span>02</span><strong>Evidence over assumption</strong><small>Decisions retain traceable context, ownership, and reporting history.</small></p>
            <p><span>03</span><strong>Privacy through restraint</strong><small>We collect only what is necessary and protect sensitive humanitarian data.</small></p>
          </div>
        </section>
      </main>
      <footer><span>© 2026 WHSF</span><span>Accountability · Safeguarding · Privacy</span></footer>
    </>
  );
}
