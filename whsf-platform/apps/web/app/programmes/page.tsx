import { Card } from "@whsf/aurora-ui";
import { InteriorPage } from "../components/interior-page";

export const metadata = { title: "Programmes" };

export default function ProgrammesPage() {
  return <InteriorPage eyebrow="Humanitarian delivery" title="Programmes shaped with communities." introduction="WHSF programmes connect locally defined priorities with transparent delivery, learning, and accountability.">
    <div className="content-grid">
      <Card><h2>Food security</h2><p>Resilient livelihoods, nutrition support, and locally appropriate food assistance.</p></Card>
      <Card><h2>Community health</h2><p>Prevention, primary care access, and health-system support close to communities.</p></Card>
      <Card><h2>Protection</h2><p>Safeguarding, referral pathways, and rights-centred assistance for people at risk.</p></Card>
    </div>
  </InteriorPage>;
}
