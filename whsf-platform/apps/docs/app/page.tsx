const sections = [
  ["Architecture", "Service boundaries, data ownership, events, and architectural decisions."],
  ["API reference", "Versioned HTTP contracts, authentication, errors, pagination, and examples."],
  ["Runbooks", "Deployment, observability, incident response, recovery, and escalation paths."],
  ["Contributing", "Local setup, quality gates, pull requests, security, and release conventions."],
];
export default function DocumentationHome() {
  return <main><p className="badge">WHSF Engineering</p><h1>Platform documentation</h1><p className="lede">The working agreement for building, operating, and evolving the WHSF humanitarian platform safely.</p><section>{sections.map(([title, copy]) => <a href="#" key={title}><span>Reference</span><h2>{title}</h2><p>{copy}</p><strong>Open section →</strong></a>)}</section></main>;
}
