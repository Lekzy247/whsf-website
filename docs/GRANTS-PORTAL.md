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
| Indico.UN `/export/categ/<ids>.json` | Personal API token | Refused without `Authorization: Bearer`; called with `onlypublic=yes` over the UN-entity categories (DESA, ECA, UNESCO, NGO Liaison UNOG… set `INDICO_UN_CATEGORIES` to override). The root category exports nothing. If the token is missing or the export returns nothing, the public Atom feeds (`/category/<id>/events.atom`, public events only: title, link, start date) are used instead. |
| Added by WHSF | Admin page | For foundations without APIs (Mastercard, Gates, Google.org, UN agencies…). |

Considered for later: Simpler.Grants.gov API (free key, still changing), ProPublica Nonprofit Explorer (US
foundation 990 data for the directory), 360Giving GrantNav (UK, bulk download only), IATI Datastore (aid flows
by country, free key), Candid / Plinth (paid foundation data, only if free sources prove thin). Sites without an
API or permission (e.g. fundsforngos, Instrumentl) are not scraped.

## Operating it

Status (2026-10-11): function deployed (`--no-verify-jwt`; it enforces its own limits: anyone may trigger a
normal run at most every 6 hours, only a signed-in grants admin can force one) and scheduled daily at 05:15 UTC
(pg_cron job `whsf-opportunity-sync`). First runs: Grants.gov 204 live, EU 60 pending, Indico.UN 101 pending
(via the public feeds).

- Redeploy after changes: `supabase functions deploy opportunity-sync --no-verify-jwt --project-ref ophymlgqnfilgxsuzcuz`
- `INDICO_UN_TOKEN` (Supabase → Edge Functions → Secrets) must have the read-only "Classic API" scope for the
  richer export; otherwise the public feeds are used.
- The EU endpoint drops compressed responses when read from Supabase, so requests ask for `identity` encoding.
- Review pending EU calls and UN events at `/grants-admin.html`.

## Phase 2: organisations, matching, eligibility (`grants-account.html`)

- Organisations sign up with the shared WHSF account (email + password, email confirmation, password reset)
  and fill in a profile: type, country, other countries, sectors, budget, and the registrations funders ask for
  (US 501(c)(3), SAM.gov UEI, EU PIC, able to partner with an EU organisation).
- Tables `whsf_grant_orgs` (one per account) and `whsf_grant_saved` (tracker: interested → preparing →
  submitted → awarded / declined / not eligible, with notes). Owner-only RLS; grants admins can read.
- Matching runs in the browser (`grants-account.js`, `evaluate()`) with no AI. Each open grant gets a checklist:
  location, applicant type, sector fit, time to prepare, source registrations (SAM.gov UEI for Grants.gov,
  PIC for EU), and award size vs budget. Verdict: any failed rule → "Probably not eligible"; at most one item to
  check → "Likely eligible"; otherwise "Check the details". Results are ranked by verdict, then score.
- Admins see registered organisations (and how many grants each saved) on the admin page.
- Supabase Auth must allow `https://www.worldhsfoundation.org/grants-account.html` as a redirect URL for the
  confirmation and password-reset links.

## Phase 3: deadline reminders and weekly matches (Edge Function `grant-alerts`)

- Runs daily at 07:00 UTC (pg_cron job `whsf-grant-alerts`); at most one run per 20 hours unless a signed-in
  grants admin forces it. Admins can also POST `{ "dry_run": true }` to see what would be sent.
- Only organisations with `alerts_opt_in` and a confirmed email get emails.
- Deadline reminders: one email per organisation listing saved grants ("Interested"/"Preparing") that reach
  30, 14 or 3 days before their deadline. Weekly (Mondays): up to 10 grants published in the last 7 days that
  the rules rate "likely" or "check the details" (`grant-alerts/match.ts` mirrors `evaluate()` in
  `grants-account.js`; keep them in sync).
- Sent through **WHSF's own Resend account** (domain worldhsfoundation.org, verified 2026-10-11; never the Gelllez
  account) from `WHSF Grants <noreply@worldhsfoundation.org>`, replies to info@. Secret `RESEND_API_KEY` in
  Supabase Edge Function secrets; capped at 90 emails per run (Resend free plan: 100/day).
- `whsf_grant_alert_log` records every email so nothing is sent twice. Each organisation has an `alerts_token`:
  the unsubscribe link (`grants-account.html?unsubscribe=<token>`) and the one-click `List-Unsubscribe` header
  both switch `alerts_opt_in` off.
- Runs appear in the admin page's import log as "Grant emails".

## Phase 4: proposal assistant (no AI cost to WHSF)

Owner rule (2026-10-11): WHSF does not pay for Claude or any AI usage.

- "Draft proposal" on every match and tracker row opens an editable draft built from a template in
  `grants-account.js` (`buildDraft`): grant, funder, deadline, amount, the organisation's profile and sector fit,
  then the sections funders usually ask for (need, project, objectives, timeline, budget, M&E, sustainability).
  Everything the organisation must write is in [square brackets].
- "Save draft" stores it in `whsf_grant_saved.draft` (adds the grant to the tracker as "Preparing" if needed);
  copy and .txt download are also available.
- A "Before you submit" checklist combines the eligibility checks with source-specific steps (SAM.gov UEI and
  Grants.gov forms; EU PIC, consortium and Part A/B templates).
- "Copy AI prompt" (`buildPrompt`) copies the grant, profile and draft with rules (no invented facts, keep
  placeholders) for the organisation to paste into **its own** Claude or ChatGPT account. WHSF never calls an AI
  API, never sees that conversation and pays nothing.

## Roadmap

- Phase 2: organisation sign-up, profile-based matching and eligibility checklist (done).
- Phase 3: deadline reminder emails (30/14/3 days) and new-match alerts via Resend (done).
- Phase 4: proposal assistant: template + copy-prompt for the organisation's own AI (done; no AI cost to WHSF).
