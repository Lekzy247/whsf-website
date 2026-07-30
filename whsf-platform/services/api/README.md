# WHSF Core API

FastAPI service for programme, partner, impact, and operations contracts. The implementation is arranged into domain, application, infrastructure, and presentation layers.

## Run

```bash
python -m venv .venv
.venv/Scripts/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

## Service endpoints

- `GET /health` — public service health contract
- `GET /live` — process liveness
- `GET /ready` — dependency readiness
- `GET /v1/meta` — versioned platform metadata

Production disables interactive API documentation. Request IDs are accepted or generated and echoed on every response.
