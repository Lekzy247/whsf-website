import { Card } from "@whsf/aurora-ui";
import Link from "next/link";

const queues = [
  { label: "Safeguarding reviews", value: 3, state: "Needs attention" },
  { label: "Programme approvals", value: 8, state: "Within SLA" },
  { label: "Data quality flags", value: 11, state: "4 due today" },
];

export default function OperationsPage() {
  return (
    <main>
      <aside>
        <div className="admin-brand"><span>W</span><strong>WHSF<br />Operations</strong></div>
        <nav aria-label="Operations"><Link aria-current="page" href="/">Overview</Link><Link href="/programmes">Programmes</Link><Link href="/partners">Partners</Link><Link href="/assurance">Assurance</Link><Link href="/settings">Settings</Link></nav>
        <a className="public-link" href="http://localhost:3000">← Public website</a>
      </aside>
      <section className="workspace">
        <header><div><p>Thursday, 30 July</p><h1>Operational overview</h1></div><button type="button">Create report</button></header>
        <div className="notice"><strong>Foundation environment</strong><span>Identity and live programme data connect in Milestone 2.</span></div>
        <div className="queue-grid">
          {queues.map((queue) => <Card className="queue" key={queue.label}><p>{queue.label}</p><strong>{queue.value}</strong><span>{queue.state}</span></Card>)}
        </div>
        <Card className="activity">
          <div><p className="kicker">Assurance feed</p><h2>Work requiring a recorded decision</h2></div>
          <table>
            <thead><tr><th>Item</th><th>Owner</th><th>Risk</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>Lake Region nutrition response</td><td>Programme assurance</td><td><span className="risk high">High</span></td><td>Review evidence</td></tr>
              <tr><td>Partner onboarding · North Corridor</td><td>Partnerships</td><td><span className="risk medium">Medium</span></td><td>Verify documents</td></tr>
              <tr><td>Quarterly expenditure reconciliation</td><td>Finance</td><td><span className="risk low">Low</span></td><td>Ready to approve</td></tr>
            </tbody>
          </table>
        </Card>
      </section>
    </main>
  );
}
