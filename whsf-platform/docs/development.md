# Development guide

## Working agreement

- Branches use `feat/`, `fix/`, `chore/`, or `docs/`.
- Commits follow Conventional Commits and describe one coherent change.
- No direct production deployment occurs from a developer workstation.
- Schema, security boundary, and public API changes require an ADR or contract review.
- Secrets must never enter source, examples, screenshots, fixtures, or logs.

## JavaScript workspace

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Applications and packages can be targeted with `pnpm --filter @whsf/web <command>`.

## Python service

```bash
cd services/api
python -m venv .venv
.venv/Scripts/activate
pip install -e ".[dev]"
ruff check app tests
mypy app
pytest
```

## Definition of done

A change includes tests at the appropriate layer, typed contracts, user-visible failure states, documentation updates, observability for new failure modes, and migration/rollback notes when state changes.
