import { InteriorPage } from "../components/interior-page";

export const metadata = { title: "Resources" };

export default function ResourcesPage() {
  return <InteriorPage eyebrow="Open resources" title="Practical knowledge, shared responsibly." introduction="Policies, field tools, research, and public reports will be published here with clear ownership and revision history.">
    <div className="prose-block"><h2>Foundation library</h2><p>The document library activates with governed publishing in a later milestone. Public resources will remain accessible without requiring an account.</p></div>
  </InteriorPage>;
}
