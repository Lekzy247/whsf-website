import { InteriorPage } from "../components/interior-page";

export const metadata = { title: "About WHSF" };

export default function AboutPage() {
  return <InteriorPage eyebrow="World Humanitarian Support Foundation" title="Support rooted in human dignity." introduction="WHSF works with communities and accountable partners to make humanitarian assistance more coordinated, transparent, and locally led.">
    <div className="prose-block"><h2>How we work</h2><p>We combine community participation, responsible stewardship, safeguarding, evidence, and learning. Technology serves those commitments; it does not replace human judgment or local leadership.</p></div>
  </InteriorPage>;
}
