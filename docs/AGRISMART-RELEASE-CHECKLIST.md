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

## 5. Browser and device checks

- [ ] Latest Chrome desktop check completed.
- [ ] Latest Microsoft Edge desktop check completed.
- [ ] Android Chrome check completed.
- [ ] iPhone or iPad Safari check completed where available.
- [ ] Mobile navigation, forms, tables, and notifications remain usable at narrow widths.
- [ ] Keyboard navigation and visible focus states are acceptable.

## 6. Deployment and security checks

- [ ] Production domain and HTTPS certificate are active.
- [ ] `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and HSTS headers are present.
- [ ] `service-worker.js` is configured for immediate cache revalidation.
- [ ] The PWA manifest is served with the correct content type.
- [ ] No secrets, passwords, API keys, or private data are committed to the repository.
- [ ] Browser storage is understood to be local to the device and browser profile.

## 7. Product and data limitations

The following limitations must be communicated before release:

- [ ] Authentication is local-only and is not production identity management.
- [ ] Cloud synchronization is an abstraction and does not use a production backend.
- [ ] Data is primarily stored in browser local storage.
- [ ] Clearing browser data or changing devices can remove access to local records unless the user exported a backup.
- [ ] Multi-user collaboration and cross-device conflict resolution are not available.
- [ ] AI, weather, marketplace, academy, and scanner capabilities must not be represented as production integrations unless their external services are configured and verified.

## 8. Operational readiness

- [ ] Product owner has approved the release scope.
- [ ] Support contact and escalation path are documented.
- [ ] Known issues and workarounds are documented.
- [ ] Rollback owner and rollback procedure are identified.
- [ ] Release commit SHA and deployment URL are recorded.
- [ ] A post-release smoke test is assigned.

## Release decision

A public production release should be approved only when all required technical, product, security, and operational checks are complete.

Until production authentication, backend persistence, monitoring, and security review are implemented, describe AgriSmart Connect as a **feature-complete offline-first MVP approaching production readiness**, not as a fully production-ready SaaS platform.
