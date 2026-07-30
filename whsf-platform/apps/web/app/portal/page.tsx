import Link from "next/link";
import { InteriorPage } from "../components/interior-page";

export const metadata = { title: "Partner portal", robots: { index: false, follow: false } };

export default function PortalPage() {
  return <InteriorPage eyebrow="Partner access" title="Secure access is being prepared." introduction="The operations portal will open after WHSF identity, multifactor authentication, and role policies pass security review.">
    <div className="prose-block"><h2>No credentials are collected yet</h2><p>This foundation release intentionally presents no simulated login. Existing authorized staff should continue using approved WHSF systems.</p><Link className="primary-link" href="/">Return to WHSF home</Link></div>
  </InteriorPage>;
}
