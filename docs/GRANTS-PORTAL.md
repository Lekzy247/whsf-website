# WHSF Grant & Funding Opportunities Portal

Public page: `grants.html` · Admin: `grants-admin.html` · UN events also appear on `opportunities.html`.

## Architecture

```
 Official APIs                      Supabase (project ophymlgqnfilgxsuzcuz)                 Website (Vercel, static)
 ─────────────                      ───────────────────────────────────────                 ────────────────────────
 Grants.gov search2/fetch ──┐
 EU Funding & Tenders  ─────┼──►  Edge Function `opportunity-sync`  ──►  whsf_opportunities ──►  grants.html (search)
 Indico.UN export (token) ──┘      (daily via pg_cron, one connector      whsf_funders       ──►  donor directory
                                    per source, normalised rows)         whsf_opportunity_*  ──►  opportunities.html (UN events)
                                                     ▲                          ▲
                                         grants-admin.html: review, publish/hide, add grants & funders, run imports
```

- **One table for everything** (`whsf_opportunities`, `kind` = grant | event). Each source writes through
  `whsf_ingest_opportunities()` (service role only), keyed on `(source, source_id)`, so re-imports update rows
  instead of duplicating them and never undo an admin's publish/hide decision.
- **Review policy per source** (`whsf_opportunity_sources.auto_publish`): Grants.gov and WHSF-added grants go live
  straight away; EU calls (usually need EU partners) and Indico.UN events (the token can also see non-public
  events) wait for an admin.
- **Secrets stay server-side.** The Indico.UN token lives only as the Edge Function secret `INDICO_UN_TOKEN`.
  The website uses the public Supabase key and reads only published rows (RLS).
- **Admins** = `info@worldhsfoundation.org` plus emails in `whsf_grant_admins` (managed on the admin page).
  `profiles.role` is deliberately not trusted (users can insert their own profile row).
- **Relevance**: imports keep only calls touching WHSF areas (ICT, STEM, AI, education, women & girls, youth),
  tagged by keyword rules. No paid AI is used.

## Sources

| Source | Access | Notes |
|---|---|---|
| Grants.gov `search2` + `fetchOpportunity` | Free, no key | US federal; WHSF is eligible as a 501(c)(3). Details fetched for 40 new grants per run. Listings with no close date older than 18 months are skipped; far-future placeholder dates show as "open until further notice". |
| EU Funding & Tenders search API | Free, public (`apiKey=SEDIA`) | Used by the EU portal itself but not formally documented, so it may change. Calls, topics and cascade (third-party) calls, open or forthcoming. |
| Indico.UN `/export/categ/<ids>.json` | Personal API token | Refused without `Authorization: Bearer`. Optional `INDICO_UN_CATEGORIES` (comma-separated ids, default `0` = everything visible to the token). |
| Added by WHSF | Admin page | For foundations without APIs (Mastercard, Gates, Google.org, UN agencies…). |

Considered for later: Simpler.Grants.gov API (free key, still changing), ProPublica Nonprofit Explorer (US
foundation 990 data for the directory), 360Giving GrantNav (UK, bulk download only), IATI Datastore (aid flows
by country, free key), Candid / Plinth (paid foundation data, only if free sources prove thin). Sites without an
API or permission (e.g. fundsforngos, Instrumentl) are not scraped.

## Operating it

1. Deploy the function: `supabase functions deploy opportunity-sync --no-verify-jwt --project-ref ophymlgqnfilgxsuzcuz`
   (the function enforces its own limits: anyone may trigger a normal run at most every 6 hours; only a signed-in
   grants admin can force one).
2. Add the secret in Supabase → Edge Functions → Secrets: `INDICO_UN_TOKEN` (from Indico.UN → My profile →
   API tokens; read-only scope is enough).
3. Apply `supabase/migrations/20261011_grant_portal_schedule.sql` to run the import every day at 05:15 UTC.
4. Sign in at `/grants-admin.html` and review the pending EU calls and UN events.

## Roadmap

- Phase 2: organisation sign-up, profile-based matching and eligibility checklist.
- Phase 3: deadline reminder emails (30/14/3 days) and new-match alerts via Resend.
- Phase 4: proposal assistant that calls Claude only when a user asks for a draft.
