# Deployment foundation

## Local composition

```bash
cp .env.example .env
docker compose up --build
```

The edge is available at `http://localhost:8080`. `/api/*` routes to FastAPI and `/operations/*` routes to the restricted admin application. The data network is internal.

## Environment promotion

1. CI produces immutable, provenance-linked images.
2. Images deploy to development after automated gates.
3. Staging runs migrations, smoke checks, accessibility checks, and recovery validation.
4. Production requires change approval and deploys by digest with automated rollback triggers.
5. Post-deploy checks verify health, critical journeys, error rate, and audit delivery.

Cloud resources are not yet provisioned. ADR-0002 records the decision gate and prevents accidental production architecture from being inferred from local Docker.
