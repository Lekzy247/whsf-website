# Security baseline

## Threat model

Primary threats include unauthorized access to beneficiary data, cross-organisation disclosure, credential theft, unsafe exports, dependency compromise, malicious uploads, and misuse of automated recommendations.

## Controls established in Milestone 1

- deny-by-default authorization helpers;
- explicit organisation-scoped record contracts;
- environment validation and no browser-secret schema;
- request correlation and structured logs;
- exact CORS allowlists and bounded methods/headers;
- edge rate limiting, payload bounds, and security headers;
- non-root, read-only application containers;
- lockfile-based CI, dependency audit, lint, type, test, and build gates;
- production-disabled API explorers;
- ADR gate before stateful infrastructure creation.

## Required before production data

- OIDC with phishing-resistant MFA for privileged roles;
- server-side policy enforcement on every protected object;
- managed secrets and encryption keys with rotation;
- WAF, DDoS controls, malware scanning, backup restoration drills, and central audit retention;
- privacy impact assessment, data classification, residency approval, and incident playbooks;
- penetration test and independent accessibility review.

Security concerns must be reported privately to the designated WHSF security contact, not through a public issue.
