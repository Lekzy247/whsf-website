// WHSF opportunity sync: pulls grants and UN events from official APIs into
// public.whsf_opportunities through the whsf_ingest_opportunities() RPC.
//
// Sources
//   grants_gov  Grants.gov search2 + fetchOpportunity (public, no key)
//   eu_ft       EU Funding & Tenders Portal search API (public)
//   indico_un   Indico.UN export API (needs the INDICO_UN_TOKEN secret)
//
// Called daily by pg_cron. Anyone may call it, but each source runs at most once
// every 6 hours unless a signed-in WHSF grants admin passes { "force": true }.
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { syncEu, syncGrantsGov, syncIndico, type Item } from './connectors.ts';

const MIN_HOURS_BETWEEN_RUNS = 6;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---------------------------------------------------------------- runner

const CONNECTORS: Record<string, (db: SupabaseClient) => Promise<{ fetched: number; items: Item[]; skipped?: string }>> = {
  grants_gov: syncGrantsGov,
  eu_ft: () => syncEu(),
  indico_un: () => syncIndico(),
};

async function isAdminCaller(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return false;
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data } = await userClient.rpc('whsf_grants_is_admin');
  return data === true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let body: { sources?: string[]; force?: boolean } = {};
  try { body = await req.json(); } catch { /* cron sends an empty body */ }
  const force = body.force === true && await isAdminCaller(req);

  const { data: sources } = await db.from('whsf_opportunity_sources')
    .select('id, enabled, last_run_at').in('id', Object.keys(CONNECTORS));
  const wanted = new Set(body.sources?.length ? body.sources : Object.keys(CONNECTORS));
  const report: Record<string, unknown> = {};

  for (const source of sources ?? []) {
    if (!wanted.has(source.id) || !source.enabled) continue;
    const hoursSince = source.last_run_at ? (Date.now() - Date.parse(source.last_run_at)) / 3.6e6 : Infinity;
    if (!force && hoursSince < MIN_HOURS_BETWEEN_RUNS) {
      report[source.id] = { skipped: `ran ${hoursSince.toFixed(1)}h ago` };
      continue;
    }

    const { data: run } = await db.from('whsf_opportunity_sync_runs').insert({ source: source.id }).select('id').single();
    let result: Record<string, unknown>;
    try {
      const { fetched, items, skipped } = await CONNECTORS[source.id](db);
      if (skipped) {
        result = { ok: true, fetched: 0, inserted: 0, updated: 0, message: skipped };
      } else {
        const { data, error } = await db.rpc('whsf_ingest_opportunities', { p_source: source.id, p_items: items });
        if (error) throw new Error(error.message);
        result = { ok: true, fetched, inserted: data.inserted, updated: data.updated,
          message: `${items.length} relevant of ${fetched} fetched` };
      }
    } catch (err) {
      result = { ok: false, message: String((err as Error).message ?? err).slice(0, 500) };
    }
    await db.from('whsf_opportunity_sync_runs').update({ ...result, finished_at: new Date().toISOString() }).eq('id', run?.id);
    await db.from('whsf_opportunity_sources').update({
      last_run_at: new Date().toISOString(),
      last_status: result.ok ? `ok: ${result.message}` : `error: ${result.message}`,
    }).eq('id', source.id);
    report[source.id] = result;
  }

  return new Response(JSON.stringify(report), { headers: { ...CORS, 'Content-Type': 'application/json' } });
});
