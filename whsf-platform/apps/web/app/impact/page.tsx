import { InteriorPage } from "../components/interior-page";

export const metadata = { title: "Impact" };

export default function ImpactPage() {
  return <InteriorPage eyebrow="Evidence and accountability" title="Impact people can examine." introduction="Reporting connects resources, delivery evidence, community feedback, and programme learning without overstating what the data can prove.">
    <div className="prose-block"><h2>Our evidence standard</h2><p>Every published indicator records its definition, reporting period, source, owner, and limitations. Sensitive or disaggregated results pass disclosure-risk review before release.</p></div>
  </InteriorPage>;
}
