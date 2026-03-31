# Contributing

Thanks for contributing to FinTrack AI.

## Development setup

1. Start PostgreSQL: `docker compose up -d`
2. Backend:
   - `cd backend && npm ci && npm run db:init && npm run dev`
3. Frontend:
   - `cd frontend && npm ci && npm run dev`
4. ML service:
   - `cd ml-service && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn app:app --reload --port 8001`

## Quality gates

Before opening a PR, run:

- `cd backend && npm test`
- `cd backend && npm run perf:smoke`
- `cd backend && npm run db:explain`
- `cd frontend && npm run build`
- `cd frontend && npm run e2e`
- `cd ml-service && python evaluate.py`

## Branch and PR rules

- Keep PRs focused and small.
- Use clear commit messages.
- Update docs when behavior changes.
- Never commit secrets or generated runtime artifacts.
