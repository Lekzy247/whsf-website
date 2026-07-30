# AgriSmart Connect Release Checklist

Use this checklist before promoting the current offline-first MVP to a public production release.

## 1. Automated validation

- [ ] GitHub Actions quality gate passes on the release commit.
- [ ] `node scripts/validate-agrismart.mjs` completes with zero failures.
- [ ] Vercel deployment finishes successfully.
- [ ] No required files, manifest icons, or HTML assets are missing.

## 2. Core workflow verification

- [ ] Dashboard loads without console errors.
- [ ] A farm can be created, edited, and removed.
- [ ] Expenses can be recorded and included in reports.
- [ ] Harvest records can be created and exported.
- [ ] Inventory items can be added and adjusted.
- [ ] Inventory movement history records stock changes correctly.
- [ ] Marketplace, Academy, AI Advisor, Weather, and Crop Scanner pages open correctly.

## 3. Offline and PWA verification

- [ ] Application can be installed from a supported browser.
- [ ] The service worker installs and activates successfully.
- [ ] Previously visited pages continue to load while offline.
- [ ] Offline changes enter the synchronization queue.
- [ ] Queued changes flush after connectivity returns.
- [ ] Application update notification appears after a new service-worker version is deployed.
- [ ] The installed application launches using the expected start URL and icons.

## 4. Backup and recovery

- [ ] A version 2 backup downloads successfully.
- [ ] Backup includes farms, expenses, harvests, inventory, and inventory movements.
- [ ] A valid backup restores all supported collections.
- [ ] A version 1 backup remains backward compatible.
- [ ] Invalid or unsupported backup files are rejected safely.
- [ ] Restore rollback preserves existing data when a storage write fails.
- [ ] A fresh backup is retained before any destructive production troubleshooting.

## 5. Account and cloud synchronization

- [ ] `supabase/migrations/20260729_agrismart_core.sql` has been applied to the production Supabase project.
- [ ] A new user can register, confirm their email when required, sign in, refresh a session, and sign out.
- [ ] Row-level security prevents one account from reading or changing another account's records.
- [ ] Farms, expenses, harvests, inventory items, inventory movements, and crop screening records restore after signing in on a second browser.
- [ ] Crop screening photos are never placed in local storage or uploaded to cloud synchronization.
- [ ] Deleting every record in a collection synchronizes the empty collection correctly.
- [ ] Switching between two accounts on one browser does not expose the previous account's farm data.
- [ ] Anonymous records remain local and migrate to the first cloud account used on that browser.
- [ ] A failed cloud request leaves the latest collection snapshot queued for retry.

## 6. Browser and device checks

- [ ] Latest Chrome desktop check completed.
- [ ] Latest Microsoft Edge desktop check completed.
- [ ] Android Chrome check completed.
- [ ] iPhone or iPad Safari check completed where available.
- [ ] Mobile navigation, forms, tables, and notifications remain usable at narrow widths.
- [ ] Keyboard navigation and visible focus states are acceptable.

## 7. Deployment and security checks

- [ ] Production domain and HTTPS certificate are active.
- [ ] `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and HSTS headers are present.
- [ ] `service-worker.js` is configured for immediate cache revalidation.
- [ ] The PWA manifest is served with the correct content type.
- [ ] No secrets, passwords, API keys, or private data are committed to the repository.
- [ ] Supabase authentication, REST access, table grants, and row-level security policies have passed production review.

## 8. Product and data limitations

The following limitations must be communicated before release:

- [ ] Records are stored locally before sign-in; cloud backup requires an authenticated Supabase account.
- [ ] Clearing browser data can remove anonymous records that have not been backed up or synchronized.
- [ ] Synchronization uses last completed collection snapshots; simultaneous multi-device editing and collaborative conflict resolution are not available.
- [ ] AI, weather, marketplace, academy, and scanner capabilities must not be represented as production integrations unless their external services are configured and verified.

## 9. Operational readiness

- [ ] Product owner has approved the release scope.
- [ ] Support contact and escalation path are documented.
- [ ] Known issues and workarounds are documented.
- [ ] Rollback owner and rollback procedure are identified.
- [ ] Release commit SHA and deployment URL are recorded.
- [ ] A post-release smoke test is assigned.

## Release decision

A public production release should be approved only when all required technical, product, security, and operational checks are complete.

Until production database migration, cloud synchronization, monitoring, browser/device checks, and security review are verified, describe AgriSmart Connect as an **offline-first MVP approaching production readiness**, not as a fully production-ready SaaS platform.
