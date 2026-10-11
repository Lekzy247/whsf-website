// Grant eligibility verdict for the weekly email. Mirrors evaluate() in grants-account.js:
// keep the two in sync when the rules change.

export type Org = {
  org_type: string;
  country: string;
  operating_countries: string[];
  sectors: string[];
  annual_budget_usd: number | null;
  has_sam_uei: boolean;
  has_eu_pic: boolean;
  can_partner_eu: boolean;
};

export type Grant = {
  source: string;
  countries: string[];
  sectors: string[];
  applicant_types: string[];
  amount_max_usd: number | null;
  deadline: string | null;
  status: string;
};

const EU_MEMBERS = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
const ORG_TYPE_MATCH: Record<string, string[]> = {
  nonprofit: ['nonprofit'], us_nonprofit: ['us_nonprofit', 'nonprofit'], school: ['school'],
  university: ['university'], business: ['business'], individual: ['individual'], government: ['government'],
};

export function verdict(grant: Grant, org: Org, today: string): { verdict: 'likely' | 'possible' | 'unlikely'; score: number } {
  const states: ('pass' | 'check' | 'fail')[] = [];
  const regions = grant.countries ?? [];
  const places = [org.country, ...(org.operating_countries ?? [])];
  if (regions.includes('GLOBAL') || regions.includes(org.country)) states.push('pass');
  else if (regions.includes('EU') && EU_MEMBERS.includes(org.country)) states.push('pass');
  else if (regions.includes('EU') && org.can_partner_eu) states.push('check');
  else if (regions.some((r) => places.includes(r))) states.push('check');
  else states.push('fail');

  const types = grant.applicant_types ?? [];
  const mine = ORG_TYPE_MATCH[org.org_type] ?? [];
  if (!types.length) states.push('check');
  else if (types.includes('any') || types.some((t) => mine.includes(t))) states.push('pass');
  else if (types.includes('other')) states.push('check');
  else states.push('fail');

  const overlap = (grant.sectors ?? []).filter((s) => (org.sectors ?? []).includes(s));
  states.push(overlap.length ? 'pass' : 'check');

  if (grant.status === 'forecasted' || !grant.deadline) states.push('check');
  else {
    const days = Math.ceil((Date.parse(`${grant.deadline}T23:59:59Z`) - Date.parse(`${today}T00:00:00Z`)) / 864e5);
    states.push(days < 10 ? 'check' : 'pass');
  }

  if (grant.source === 'grants_gov') states.push(org.has_sam_uei ? 'pass' : 'check');
  else if (grant.source === 'eu_ft') states.push(org.has_eu_pic ? 'pass' : 'check');

  if (org.annual_budget_usd && grant.amount_max_usd && grant.amount_max_usd > org.annual_budget_usd * 5) states.push('check');

  const fails = states.filter((s) => s === 'fail').length;
  const checks = states.filter((s) => s === 'check').length;
  const weight = { pass: 1, check: 0.5, fail: 0 };
  const score = Math.min(100, Math.round((states.reduce((sum, s) => sum + weight[s], 0) / states.length) * 100)
    + Math.min(overlap.length, 3) * 3);
  return { verdict: fails ? 'unlikely' : checks <= 1 ? 'likely' : 'possible', score };
}
