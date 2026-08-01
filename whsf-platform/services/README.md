# Service boundaries

| Service | Owns | Foundation status |
| --- | --- | --- |
| `api` | Programmes, partners, impact, and primary HTTP contracts | Runnable |
| `auth` | Identity, sessions, MFA, and policy decisions | Boundary defined |
| `notifications` | Email, SMS, push, templates, and delivery records | Boundary defined |
| `search` | Search projections and query APIs | Boundary defined |
| `analytics` | Privacy-reviewed aggregate reporting | Boundary defined |
| `ai` | Guardrailed model workflows and evaluations | Boundary defined |

Services communicate through versioned contracts and events. No service reads another service's private persistence tables.
