# WHSF Enterprise Humanitarian Platform

This workspace is the secure, service-oriented successor to the existing WHSF public website. It is intentionally isolated from the current static site so migration can happen module by module without interrupting production.

## Foundation scope

Milestone 1 establishes:

- pnpm monorepo governance and shared TypeScript policy;
- public, administration, documentation, and Storybook applications;
- reusable Aurora UI, SDK, authentication, database, and shared packages;
- FastAPI service boundaries with health, readiness, request ID, and structured logging support;
- local Docker composition, reverse proxy, monitoring, CI, and architectural records.

## Requirements

- Node.js 22+
- pnpm 10+
- Python 3.13+
- Docker with Compose

## Start locally

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Run the API separately:

```bash
cd services/api
python -m venv .venv
.venv/Scripts/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

The public application runs at `http://localhost:3000`, administration at `http://localhost:3001`, documentation at `http://localhost:3002`, and the API at `http://localhost:8000`.

## Quality gates

```bash
pnpm quality
cd services/api && pytest && ruff check app tests && mypy app
```

See [docs/architecture.md](docs/architecture.md) for system boundaries and [docs/development.md](docs/development.md) for the contributor workflow.
