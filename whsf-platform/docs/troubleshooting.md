# Troubleshooting

## A workspace package cannot resolve

Run `pnpm install` from `whsf-platform`, not an individual app. Confirm the package is listed under `pnpm-workspace.yaml`.

## Next.js reports stale generated types

Remove the affected app's `.next` directory and rerun `pnpm --filter <package> typecheck`. Generated folders are never committed.

## API settings fail during startup

Copy `.env.example` to `.env`, verify `WHSF_ENVIRONMENT` is one of `development`, `test`, `staging`, or `production`, and ensure CORS origins are valid JSON when passed through Docker.

## Docker services are unhealthy

Use `docker compose ps` and service logs. Check PostgreSQL and Redis before the API, then API health before web routes. Do not disable health checks to make startup pass.
