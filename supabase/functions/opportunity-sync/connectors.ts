// Connectors: fetch from each official API and normalise into Item rows.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export type Item = {
  source_id: string;
  title: string;
  funder_name?: string;
  summary?: string;
  url?: string;
  countries?: string[];
  location?: string;
  sectors?: string[];
  applicant_types?: string[];
  amount_min_usd?: number | null;
  amount_max_usd?: number | null;
  amount_note?: string;
  open_date?: string | null;
  deadline?: string | null;
  deadline_note?: string;
  status?: 'forecasted' | 'open' | 'closed';
  raw?: Record<string, unknown>;
  detailed?: boolean;
};


// ---------------------------------------------------------------- classification

const SECTOR_RULES: [string, RegExp][] = [
  ['ai', /\bartificial intelligence\b|\bmachine learning\b|\bAI\b/],
  ['ict', /\bICT\b|\bdigital\b|broadband|internet|computer|cyber|software|coding|technolog/i],
  ['stem', /\bSTEM\b|\bscience\b|engineering|mathemat|robotic/i],
  ['education', /educat|school|teacher|literacy|curricul|student|learning|skills/i],
  ['womens_empowerment', /\bwomen\b|\bgirls?\b|gender|female/i],
  ['youth', /\byouth\b|young people|adolescen|\bchild(ren)?\b/i],
  ['health', /\bhealth|medical|disease/i],
  ['agriculture', /agricultur|\bfarm|food security/i],
  ['climate', /climate|environment|renewable|sustainab/i],
  ['humanitarian', /humanitarian|refugee|disaster|crisis|emergency|displace/i],
  ['economic_development', /entrepreneur|employment|livelihood|economic develop|workforce/i],
];
// WHSF programme areas: grants must touch at least one of these to be imported.
const WHSF_FOCUS = new Set(['ai', 'ict', 'stem', 'education', 'womens_empowerment', 'youth']);

// Titles carry most of the signal; long descriptions mention everything, so only
// their opening is used.
function sectorsFor(title: string, description = ''): string[] {
  const text = `${title} ${description.slice(0, 400)}`;
  return SECTOR_RULES.filter(([, re]) => re.test(text)).map(([s]) => s);
}
const isWhsfRelevant = (sectors: string[]) => sectors.some((s) => WHSF_FOCUS.has(s));

const ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", rsquo: "'", lsquo: "'",
  ldquo: '"', rdquo: '"', ndash: '–', mdash: '—', hellip: '…', bull: '•', middot: '·',
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ').trim();
}

// Some agencies use a far-future close date to mean "open until further notice".
function realDeadline(date: string | null): string | null {
  if (!date) return null;
  const fiveYears = new Date(Date.now() + 5 * 365 * 864e5).toISOString().slice(0, 10);
  return date > fiveYears ? null : date;
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  const s = String(value);
  const us = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); // Grants.gov MM/DD/YYYY
  if (us) return `${us[3]}-${us[1]}-${us[2]}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function money(value: unknown): number | null {
  const n = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = 25000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${new URL(url).host} returned ${res.status}`);
  return res.json();
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

// ---------------------------------------------------------------- Grants.gov

const GRANTS_GOV_KEYWORDS = [
  'STEM education', 'computer science', 'digital literacy', 'digital equity', 'artificial intelligence',
  'technology education', 'girls', 'women', 'youth', 'workforce development', 'education',
  'international development', 'cybersecurity education',
];
// 12 = 501(c)(3) nonprofits, 13 = other nonprofits, 25 = others, 99 = unrestricted.
const GRANTS_GOV_ELIGIBILITIES = '12|13|25|99';
const GRANTS_GOV_APPLICANTS: Record<string, string[]> = {
  '12': ['nonprofit', 'us_nonprofit'], '13': ['nonprofit'], '11': ['nonprofit'],
  '25': ['other'], '99': ['any'], '05': ['school'], '06': ['university'], '20': ['university'],
  '00': ['government'], '01': ['government'], '02': ['government'], '04': ['government'], '07': ['government'],
  '21': ['individual'], '22': ['business'], '23': ['business'],
};
const MAX_DETAIL_FETCHES = 40;

export async function syncGrantsGov(db: SupabaseClient): Promise<{ fetched: number; items: Item[] }> {
  const hits = new Map<string, any>();
  for (const keyword of GRANTS_GOV_KEYWORDS) {
    const body = { keyword, oppStatuses: 'forecasted|posted', eligibilities: GRANTS_GOV_ELIGIBILITIES, rows: 200 };
    const r = await fetchJson('https://api.grants.gov/v1/api/search2', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    for (const hit of r?.data?.oppHits ?? []) hits.set(String(hit.id), hit);
  }

  const { data: known } = await db.from('whsf_opportunities')
    .select('source_id, summary, details_fetched_at').eq('source', 'grants_gov');
  const knownById = new Map((known ?? []).map((row) => [row.source_id, row]));

  const relevant = [...hits.values()].filter((hit) => {
    const saved = knownById.get(String(hit.id));
    return isWhsfRelevant(sectorsFor(hit.title, saved?.summary ?? ''));
  });
  const needDetails = relevant.filter((hit) => !knownById.get(String(hit.id))?.details_fetched_at)
    .slice(0, MAX_DETAIL_FETCHES);
  const details = new Map<string, any>();
  await mapLimit(needDetails, 5, async (hit) => {
    try {
      const r = await fetchJson('https://api.grants.gov/v1/api/fetchOpportunity', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: Number(hit.id) }),
      });
      if (r?.data) details.set(String(hit.id), r.data);
    } catch { /* retry next run */ }
  });

  const items: Item[] = relevant.map((hit) => {
    const id = String(hit.id);
    const d = details.get(id);
    const syn = d?.synopsis ?? d?.forecast ?? null;
    const summary = syn ? stripHtml(syn.synopsisDesc ?? syn.forecastDesc ?? '') : '';
    const saved = knownById.get(id);
    const applicants = syn
      ? [...new Set((syn.applicantTypes ?? []).flatMap((t: any) => GRANTS_GOV_APPLICANTS[String(t.id)] ?? ['other']))]
      : [];
    const item: Item = {
      source_id: id,
      title: stripHtml(hit.title),
      funder_name: d?.agencyDetails?.agencyName ?? hit.agency ?? d?.topAgencyDetails?.agencyName ?? 'US federal agency',
      summary,
      url: `https://www.grants.gov/search-results-detail/${id}`,
      countries: ['US'],
      location: 'United States',
      sectors: sectorsFor(hit.title, summary || saved?.summary || ''),
      applicant_types: applicants as string[],
      amount_min_usd: syn ? money(syn.awardFloor) : null,
      amount_max_usd: syn ? money(syn.awardCeiling) : null,
      open_date: toIsoDate(hit.openDate),
      deadline: realDeadline(toIsoDate(hit.closeDate)),
      deadline_note: !hit.closeDate ? 'No close date listed (check the opportunity)'
        : realDeadline(toIsoDate(hit.closeDate)) ? '' : 'Open until further notice',
      status: hit.oppStatus === 'forecasted' ? 'forecasted' : 'open',
      raw: { number: hit.number, agencyCode: hit.agencyCode, cfda: hit.cfdaList ?? [] },
      detailed: Boolean(syn),
    };
    return item;
  });
  return { fetched: hits.size, items };
}

// ---------------------------------------------------------------- EU Funding & Tenders

const EU_KEYWORDS = [
  'digital skills', 'education', 'girls', 'women', 'youth', 'artificial intelligence', 'STEM',
  'digital inclusion', 'development cooperation', 'civil society',
];
const EU_STATUS = { forthcoming: '31094501', open: '31094502' };

export async function syncEu(): Promise<{ fetched: number; items: Item[] }> {
  const seen = new Map<string, any>();
  const query = JSON.stringify({
    bool: { must: [{ terms: { type: ['1', '2', '8'] } }, { terms: { status: Object.values(EU_STATUS) } }] },
  });
  for (const text of EU_KEYWORDS) {
    const form = new FormData();
    form.append('query', new Blob([query], { type: 'application/json' }));
    form.append('languages', new Blob(['["en"]'], { type: 'application/json' }));
    const url = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&pageSize=50&pageNumber=1&text='
      + encodeURIComponent(text);
    const r = await fetchJson(url, { method: 'POST', body: form });
    for (const res of r?.results ?? []) if (res?.reference) seen.set(res.reference, res);
  }

  const today = new Date().toISOString().slice(0, 10);
  const items: Item[] = [];
  for (const [reference, res] of seen) {
    const m = res.metadata ?? {};
    const first = (key: string) => (Array.isArray(m[key]) ? m[key][0] : m[key]) ?? '';
    const identifier = String(first('identifier'));
    const title = stripHtml(String(first('title') || res.summary || identifier));
    const callTitle = stripHtml(String(first('callTitle')));
    const description = stripHtml(String(first('description')));
    const deadlines: string[] = (Array.isArray(m.deadlineDate) ? m.deadlineDate : [m.deadlineDate])
      .map(toIsoDate).filter((d: string | null): d is string => Boolean(d)).sort();
    const deadline = deadlines.find((d) => d >= today) ?? null;
    if (deadlines.length && !deadline) continue; // all deadlines passed

    const sectors = sectorsFor(`${title} ${callTitle}`, description);
    if (!isWhsfRelevant(sectors)) continue;

    const type = String(first('type'));
    const portalUrl = String(first('url') || res.url || '');
    const url = portalUrl.includes('/portal/screen/')
      ? portalUrl
      : type === '8'
        ? 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/calls-for-proposals?isExactMatch=true&status=31094501,31094502&keywords=' + encodeURIComponent(identifier)
        : `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${identifier}`;

    items.push({
      source_id: reference,
      title: callTitle && callTitle !== title ? `${title} — ${callTitle}` : title,
      funder_name: type === '8' ? 'EU-funded cascade call (third-party funding)' : 'European Commission',
      summary: description || callTitle,
      url,
      countries: ['EU'],
      location: 'European Union (check eligible countries in the call)',
      sectors,
      open_date: toIsoDate(first('startDate')),
      deadline,
      deadline_note: deadlines.length > 1 ? 'Multiple deadline stages' : '',
      status: String(first('status')) === EU_STATUS.forthcoming ? 'forecasted' : 'open',
      raw: { identifier, type },
      detailed: true,
    });
  }
  return { fetched: seen.size, items };
}

// ---------------------------------------------------------------- Indico.UN

const UN_EVENT_KEYWORDS = /ECOSOC|\bSDGs?\b|sustainable development|civil society|\bNGOs?\b|youth|women|girls|gender|digital|technolog|education|innovation|artificial intelligence|\bICT\b|science/i;

export async function syncIndico(): Promise<{ fetched: number; items: Item[]; skipped?: string }> {
  const token = Deno.env.get('INDICO_UN_TOKEN');
  if (!token) return { fetched: 0, items: [], skipped: 'INDICO_UN_TOKEN secret is not set' };
  const categories = (Deno.env.get('INDICO_UN_CATEGORIES') || '0').replace(/\s/g, '').replace(/,/g, '-');
  const url = `https://indico.un.org/export/categ/${categories}.json?from=today&to=%2B180d&limit=1000&order=start`;
  const r = await fetchJson(url, { headers: { Authorization: `Bearer ${token}` } }, 45000);
  const results: any[] = r?.results ?? [];

  const items: Item[] = [];
  for (const ev of results) {
    const description = stripHtml(String(ev.description ?? ''));
    const text = `${ev.title ?? ''} ${description} ${ev.category ?? ''}`;
    if (!UN_EVENT_KEYWORDS.test(text)) continue;
    const sectors = sectorsFor(`${ev.title ?? ''} ${ev.category ?? ''}`, description);
    const start = ev.startDate?.date ?? null;
    const end = ev.endDate?.date ?? start;
    items.push({
      source_id: String(ev.id),
      title: stripHtml(String(ev.title ?? 'UN event')),
      funder_name: String(ev.category ?? 'United Nations'),
      summary: description.slice(0, 1500),
      url: String(ev.url ?? `https://indico.un.org/event/${ev.id}/`),
      countries: ['GLOBAL'],
      location: [ev.location, ev.room].filter(Boolean).join(', '),
      sectors,
      open_date: start,
      deadline: end,
      deadline_note: 'Event dates (start – end)',
      status: 'open',
      raw: { type: ev.type ?? '', categoryId: ev.categoryId ?? null, timezone: ev.timezone ?? '' },
      detailed: true,
    });
  }
  return { fetched: results.length, items };
}

