// Daily sync of scholarships and fully / partially funded events for the Forum's Grants & Scholarships hub
// (Vercel Cron, see vercel.json). Sources: the public WordPress APIs of three opportunity sites
//   ofa = Opportunities for Africans, asa = After School Africa, oc = Opportunities Corners.
// We keep only listings whose deadline is still ahead, store title + deadline + a short summary, and link every card to
// the source page (which links to the official programme). Events are kept only when they say they are funded
// (fully funded, travel grant, stipend, all expenses paid...). Rows go through whsf_opportunities_ingest_partner, which
// checks JOBS_INGEST_SECRET (same secret as the job sync) and each source's auto_publish switch.
// Vercel Cron calls this with "Authorization: Bearer <CRON_SECRET>".

const SUPABASE_URL = 'https://ophymlgqnfilgxsuzcuz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh';
const UA = 'WHSF-Forum-Opportunities/1.0 (+https://www.worldhsfoundation.org/forum.html)';
const PAGES = 3; // 50 newest posts per page per category group

// WordPress category ids on each site (from /wp-json/wp/v2/categories).
const SOURCES = {
  ofa: { base: 'https://www.opportunitiesforafricans.com', scholarship: '12,385,1395', funded_event: '11,7917' },
  asa: { base: 'https://www.afterschoolafrica.com', scholarship: '13,55,68,117,2906', funded_event: '2323,2888' },
  oc: { base: 'https://opportunitiescorners.com', scholarship: '64,933,934,935,936,937,938,939,941,942,960', funded_event: '66,61,1058' }
};

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const FULLY = /fully[\s-]*funded|full(y)? scholarship|full tuition|all[\s-]*expenses?[\s-]*paid|fully sponsored|fully covered/i;
const FUNDED = /funded|sponsor|travel (grant|support|bursar)|bursar|stipend|scholarship|allowance|tuition waiver|covers? (the )?(cost|flight|travel|accommodation|visa)|paid (trip|travel)|free of charge|no (participation |registration )?fee/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const decode = (s) => String(s ?? '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&hellip;/g, '…').replace(/&[lr]squo;/g, "'").replace(/&[lr]dquo;/g, '"').replace(/&[nm]dash;/g, '–');
const text = (html) => decode(String(html ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const today = () => new Date().toISOString().slice(0, 10);

// First date after a "Deadline" label: "September 30, 2026" | "15 October 2026" | "October 2nd, 2026" -> "2026-09-30"
function parseDeadline(s) {
  const re = /deadline[^:.\n]{0,25}:?\s*(.{0,45})/gi;
  let m;
  while ((m = re.exec(s || ''))) {
    const part = m[1].replace(/(\d)(st|nd|rd|th)\b/gi, '$1').replace(/[,.]/g, ' ').toLowerCase();
    let day; let month; let year; let x;
    if ((x = /\b([a-z]+)\s+(\d{1,2})\s+(\d{4})/.exec(part)) && MONTHS.includes(x[1])) { month = MONTHS.indexOf(x[1]); day = +x[2]; year = +x[3]; }
    else if ((x = /\b(\d{1,2})\s+([a-z]+)\s+(\d{4})/.exec(part)) && MONTHS.includes(x[2])) { day = +x[1]; month = MONTHS.indexOf(x[2]); year = +x[3]; }
    else continue;
    const d = new Date(Date.UTC(year, month, day));
    if (d.getUTCMonth() === month && year >= 2020 && year <= 2100) return d.toISOString().slice(0, 10);
  }
  return null;
}

function levels(t) {
  const out = [];
  if (/undergrad|bachelor|first degree/i.test(t)) out.push('undergraduate');
  if (/master|\bmsc\b|\bmba\b|postgraduate|graduate stud/i.test(t)) out.push('masters');
  if (/ph\.?\s?d|doctoral|doctorate/i.test(t)) out.push('phd');
  if (/short course|summer school|winter school|training/i.test(t)) out.push('short_course');
  return out;
}

function toRow(post, kind, base) {
  const title = text(post?.title?.rendered);
  const excerpt = text(post?.excerpt?.rendered);
  const body = text(post?.content?.rendered).slice(0, 6000);
  const url = typeof post?.link === 'string' && post.link.startsWith(`${base}/`) ? post.link : null;
  if (!url || title.length < 5 || !/^\d+$/.test(String(post.id))) return null;
  const deadline = parseDeadline(excerpt) || parseDeadline(body);
  if (!deadline || deadline < today()) return null; // only listings still open
  const both = `${title} ${excerpt} ${body.slice(0, 1500)}`;
  if (kind === 'funded_event' && !FUNDED.test(both)) return null; // events must say they are funded
  const summary = (excerpt || body).replace(/^[\s\S]*?deadline\s*:?[\s\S]*?\b\d{4}\b\.?\s*/i, '')
    .replace(/\s*\[(…|\.\.\.)\]\s*$/, '…').replace(/\s*…?\s*Read more\s*$/i, '…').slice(0, 400);
  return { kind, source_id: String(post.id), title: title.slice(0, 300), summary, url, deadline,
    funding: FULLY.test(both) ? 'fully_funded' : 'funded', study_levels: levels(title) };
}

async function getPosts(base, categories, page) {
  const url = `${base}/wp-json/wp/v2/posts?categories=${categories}&per_page=50&page=${page}&_fields=id,link,title,excerpt,content`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (res.status === 429 || res.status >= 500) { await sleep(5000 * (attempt + 1)); continue; }
    if (res.status === 400) return []; // past the last page
    if (!res.ok) throw new Error(`answered ${res.status}`);
    return res.json();
  }
  throw new Error('kept failing');
}

async function ingest(secret, source, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/whsf_opportunities_ingest_partner`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_secret: secret, p_source: source, p_rows: rows })
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message || res.status);
  return body;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const cronSecret = process.env.CRON_SECRET;
  const ingestSecret = process.env.JOBS_INGEST_SECRET;
  if (!cronSecret || !ingestSecret) return response.status(503).json({ error: 'Sync is not configured.' });
  if (request.headers.authorization !== `Bearer ${cronSecret}`) return response.status(401).json({ error: 'Not allowed.' });

  const report = {};
  const problems = [];
  for (const [source, cfg] of Object.entries(SOURCES)) {
    const rows = new Map(); // scholarships first, so a post in both groups counts as a scholarship
    for (const kind of ['scholarship', 'funded_event']) {
      for (let page = 1; page <= PAGES; page += 1) {
        try {
          const posts = await getPosts(cfg.base, cfg[kind], page);
          posts.forEach((p) => { const r = toRow(p, kind, cfg.base); if (r && !rows.has(r.source_id)) rows.set(r.source_id, r); });
          if (posts.length < 50) break;
        } catch (err) { problems.push(`${source} ${kind} p${page}: ${err.message}`); break; }
        await sleep(800);
      }
    }
    const all = [...rows.values()];
    let written = 0;
    if (all.length) { try { written = await ingest(ingestSecret, source, all); } catch (err) { problems.push(`${source} save: ${err.message}`); } }
    report[source] = { scholarships: all.filter((r) => r.kind === 'scholarship').length, funded_events: all.filter((r) => r.kind === 'funded_event').length, written };
  }
  const summary = { ...report, problems };
  console.log('opportunities-sync', JSON.stringify(summary));
  const anyWritten = Object.values(report).some((r) => r.written);
  return response.status(problems.length && !anyWritten ? 502 : 200).json(summary);
}
