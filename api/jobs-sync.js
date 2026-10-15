// Daily Career Center sync (Vercel Cron, see vercel.json). Pulls recent jobs from two free public job APIs and stores
// them in public.forum_partner_jobs through forum_partner_jobs_ingest (secret-checked, no service-role key needed):
//   - Himalayas (https://himalayas.app/api): jobs open to people in each African country + jobs open worldwide.
//   - Jobicy (https://jobicy.com/jobs-rss-feed): remote jobs open "Anywhere".
// Source terms we follow: credit the source and always apply through its own link (the Forum does both), stay well
// under the rate limits (~100 calls once a day), remove expired listings (cleanup below), and never pass the jobs on
// to other job boards or search engines (no JobPosting data is published for them).
// Vercel Cron calls this with "Authorization: Bearer <CRON_SECRET>".

const SUPABASE_URL = 'https://ophymlgqnfilgxsuzcuz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh';
const UA = 'WHSF-Forum-Careers/1.0 (+https://www.worldhsfoundation.org/forum.html)';
// 19 jobs per page, newest first; listings are kept until they expire, so the list grows day by day.
const PAGES_PER_COUNTRY = Math.min(Number(process.env.JOBS_PAGES_PER_COUNTRY) || 4, 20);
const WORLDWIDE_PAGES = 8;

// Display name -> ISO code. The display name is what members see and filter by.
const AFRICA = {
  Nigeria: 'NG', Kenya: 'KE', 'South Africa': 'ZA', Ghana: 'GH', Egypt: 'EG', Ethiopia: 'ET', Rwanda: 'RW',
  Uganda: 'UG', Tanzania: 'TZ', Morocco: 'MA', Tunisia: 'TN', Algeria: 'DZ', Senegal: 'SN', "Côte d'Ivoire": 'CI',
  Cameroon: 'CM', Zambia: 'ZM', Zimbabwe: 'ZW', Malawi: 'MW', Mozambique: 'MZ', Botswana: 'BW', Namibia: 'NA',
  'DR Congo': 'CD', 'Sierra Leone': 'SL', Liberia: 'LR', Gambia: 'GM', Benin: 'BJ', Togo: 'TG', 'Burkina Faso': 'BF',
  Mali: 'ML', Niger: 'NE', Sudan: 'SD', 'South Sudan': 'SS', Somalia: 'SO', Madagascar: 'MG', Mauritius: 'MU', Angola: 'AO'
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (v, max) => String(v ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim().slice(0, max);
const https = (u) => (typeof u === 'string' && /^https:\/\//.test(u) ? u : null);
const iso = (v) => { if (v == null || v === '') return null; const d = typeof v === 'number' ? new Date(v * 1000) : new Date(v); return Number.isNaN(+d) ? null : d.toISOString(); };
const firstOf = (v) => { if (Array.isArray(v)) return v[0]; try { const a = JSON.parse(String(v).replace(/'/g, '"')); return Array.isArray(a) ? a[0] : v; } catch { return v; } };

async function getJson(url) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (res.status === 429) { await sleep(Number(res.headers.get('retry-after')) * 1000 || 5000); continue; }
    if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
    return res.json();
  }
  throw new Error(`${new URL(url).host} kept rate-limiting`);
}

function fromHimalayas(j, country, worldwide) {
  const url = https(j.applicationLink) || https(j.guid);
  if (!url || !j.title) return null;
  return {
    id: `himalayas:${url}`, source: 'himalayas', title: text(j.title, 200), company: text(j.companyName, 160),
    company_logo: https(j.companyLogo), url,
    location_restrictions: (j.locationRestrictions || []).map((c) => text(c, 60)).slice(0, 80),
    match_countries: country ? [country] : [], worldwide: Boolean(worldwide || !(j.locationRestrictions || []).length),
    employment_type: text(j.employmentType, 40) || null, seniority: text((j.seniority || [])[0], 60) || null,
    category: text((j.parentCategories || j.categories || [])[0], 80).replace(/-/g, ' ') || null,
    excerpt: text(j.excerpt, 600) || null,
    salary_min: j.minSalary ?? null, salary_max: j.maxSalary ?? null, currency: text(j.currency, 8) || null,
    salary_period: text(j.salaryPeriod, 20) || null, published_at: iso(j.pubDate), expires_at: iso(j.expiryDate)
  };
}

function fromJobicy(j) {
  const url = https(j.url);
  if (!url || !j.jobTitle) return null;
  const published = iso(j.pubDate);
  return {
    id: `jobicy:${url}`, source: 'jobicy', title: text(j.jobTitle, 200), company: text(j.companyName, 160),
    company_logo: https(j.companyLogo), url, location_restrictions: [], match_countries: [], worldwide: true,
    employment_type: text(firstOf(j.jobType), 40) || null, seniority: j.jobLevel && j.jobLevel !== 'Any' ? text(j.jobLevel, 60) : null,
    category: text(firstOf(j.jobIndustry), 80) || null, excerpt: text(j.jobExcerpt, 600) || null,
    salary_min: j.salaryMin ?? j.annualSalaryMin ?? null, salary_max: j.salaryMax ?? j.annualSalaryMax ?? null,
    currency: text(j.salaryCurrency, 8) || null, salary_period: text(j.salaryPeriod, 20) || null,
    published_at: published,
    // Jobicy gives no expiry date: keep a listing 30 days after publication at most.
    expires_at: published ? new Date(new Date(published).getTime() + 30 * 86400000).toISOString() : null
  };
}

async function rpc(name, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${name}: ${body?.message || res.status}`);
  return body;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const cronSecret = process.env.CRON_SECRET;
  const ingestSecret = process.env.JOBS_INGEST_SECRET;
  if (!cronSecret || !ingestSecret) return response.status(503).json({ error: 'Job sync is not configured.' });
  if (request.headers.authorization !== `Bearer ${cronSecret}`) return response.status(401).json({ error: 'Not allowed.' });

  const jobs = new Map(); // id -> job, so a job found under several countries is sent once with all of them
  const add = (job) => {
    if (!job) return;
    const seen = jobs.get(job.id);
    if (!seen) { jobs.set(job.id, job); return; }
    seen.match_countries = [...new Set([...seen.match_countries, ...job.match_countries])];
    seen.worldwide = seen.worldwide || job.worldwide;
  };
  const problems = [];

  for (const [name, code] of Object.entries(AFRICA)) {
    for (let page = 1; page <= PAGES_PER_COUNTRY; page += 1) {
      try {
        const d = await getJson(`https://himalayas.app/jobs/api/search?country=${code}&exclude_worldwide=true&sort=recent&page=${page}`);
        (d.jobs || []).forEach((j) => add(fromHimalayas(j, name, false)));
        const got = (d.jobs || []).length;
        if (!got || page * (Number(d.limit) || 19) >= (Number(d.totalCount) || 0)) break; // last page reached
      } catch (err) { problems.push(`Himalayas ${code}: ${err.message}`); break; }
      await sleep(400);
    }
  }
  for (let page = 1; page <= WORLDWIDE_PAGES; page += 1) {
    try {
      const d = await getJson(`https://himalayas.app/jobs/api/search?worldwide=true&sort=recent&page=${page}`);
      (d.jobs || []).forEach((j) => add(fromHimalayas(j, null, true)));
    } catch (err) { problems.push(`Himalayas worldwide: ${err.message}`); break; }
    await sleep(400);
  }
  try {
    const d = await getJson('https://jobicy.com/api/v2/remote-jobs?count=100&geo=anywhere');
    (d.jobs || []).forEach((j) => add(fromJobicy(j)));
  } catch (err) { problems.push(`Jobicy: ${err.message}`); }

  let written = 0;
  const all = [...jobs.values()];
  try {
    for (let i = 0; i < all.length; i += 500) written += await rpc('forum_partner_jobs_ingest', { p_secret: ingestSecret, p_jobs: all.slice(i, i + 500) });
  } catch (err) { problems.push(`Save: ${err.message}`); }
  let removed = 0;
  try { removed = await rpc('forum_partner_jobs_cleanup', { p_secret: ingestSecret }); } catch (err) { problems.push(`Cleanup: ${err.message}`); }

  const summary = { fetched: all.length, written, removed, problems };
  console.log('jobs-sync', JSON.stringify(summary));
  return response.status(problems.length && !written ? 502 : 200).json(summary);
}
