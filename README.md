# FinTrack AI

A production-oriented expense intelligence platform with:

- React frontend dashboard
- Node.js backend API with PostgreSQL
- Python FastAPI ML microservice for forecasting and categorization

## Project Structure

- `frontend/` → React + Vite + Recharts
- `backend/` → Express REST API (JWT auth, expenses, budgets, analytics, prediction, insights)
- `backend/db/schema.sql` → SQL schema (users, expenses, budgets)
- `ml-service/` → FastAPI service (classification + regression baseline)
- `docker-compose.yml` → local PostgreSQL container

## Core Features

- Expense CRUD (`create`, `list`, `delete`)
- Basic auto-categorization (keyword + fallback)
- JWT authentication (`register`, `login`)
- PostgreSQL-backed data model (no in-memory runtime persistence)
- Prisma schema + seed workflow for migration-ready development
- Monthly analytics (totals + category split + daily trend)
- Spending prediction (simple linear regression over previous months)
- Prediction explainability fields (`confidence`, `trendSlope`, `reasonCode`, `featurePipelineVersion`)
- ML service split by capability (`categorization`, `monthly_forecast`) with model/version metadata
- Budget alerts (threshold checks)
- Smart insights (weekend bias, month-over-month change, top merchant)
- Anomaly detection (z-score outliers)
- ML service integration with graceful fallback
- Expense table filters: search, category, sorting, pagination
- Structured backend error responses + async error safety
- Integration test suite for critical API workflows
- In-memory API caching for analytics/prediction/insights/anomalies with mutation invalidation
- CI workflow for backend tests, frontend e2e and ML evaluation
- API rate limiting + login brute-force lockout protection
- Request validation middleware for auth/expenses/budgets
- Refresh-token session rotation (`/auth/refresh`, `/auth/logout`)
- Structured logs + per-request `traceId` (`X-Trace-Id` header)
- Security middleware: Helmet + response compression + CORS allowlist support
- Audit logs for auth and mutation actions (`audit_logs` table)

## Quick Start

### 1) Start PostgreSQL

```bash
docker compose up -d
```

### 2) Backend

```bash
cd backend
npm install
npm run db:init
npm run prisma:generate
npm run dev
```

Backend runs at `http://localhost:4000`.

### 3) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

### 4) Optional ML service

```bash
cd ml-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

ML service runs at `http://localhost:8000`.

### 5) Optional seed data (Prisma)

```bash
cd backend
npm run prisma:seed
```

Demo credentials: `demo@expense.app` / `password123`

### 6) Run backend tests

```bash
cd backend
npm test
npm run test:coverage
```

### 7) Run frontend e2e tests (Playwright)

```bash
cd frontend
npm run e2e:install
npm run e2e
```

### 8) Run ML evaluation checks

```bash
cd ml-service
python evaluate.py
```

### 9) Run backend performance smoke

```bash
cd backend
npm run perf:smoke
```

This validates a non-ML API P95 latency threshold (`PERF_P95_MAX_MS`, default 300ms).

Optional perf smoke alert controls:

- `PERF_FAIL_ON_ALERTS` (`true|false`, default `true`)
- `PERF_BLOCKING_ALERT_CODES` (comma-separated; empty means all alerts are blocking)
It also reads `/api/metrics` and can fail on operational alerts (`PERF_FAIL_ON_ALERTS=true`).
Perf smoke report artifact: `backend/test-results/perf-smoke.json`.

### 10) Run DB query plan smoke

```bash
cd backend
npm run db:explain
```

This records `EXPLAIN (ANALYZE)` summaries for common month/category/search expense queries.
It fails when probe execution time exceeds the configured threshold.

Optional env controls:

- `EXPLAIN_MONTH` (default `2026-03`)
- `EXPLAIN_SAMPLE_SIZE` (default `400`)
- `EXPLAIN_MAX_EXEC_MS` (default `25`)

Query plan artifact: `backend/test-results/query-plans.json`.

This writes a report at `ml-service/evaluation_report.json` and exits with non-zero status when thresholds fail.

The evaluation report now includes:

- classification confusion matrix + per-class F1
- regression rolling-window backtest metrics
- drift indicator checks for classification and regression

## CI

GitHub Actions workflow: `.github/workflows/ci.yml`

Runs on push/PR:

- Backend API tests (`npm test`)
- Backend performance smoke (`npm run perf:smoke`)
- Frontend production build (`npm run build`)
- Frontend Playwright e2e tests (`npm run e2e`)
- ML evaluation threshold gate (2 consecutive passes) (`python evaluate.py` x2)

Security behavior:

- Global API rate limiting (`/api/*`)
- Stricter auth rate limiting (`/api/auth/*`)
- Repeated failed logins trigger temporary account lock (`429 ACCOUNT_LOCKED`)
- Standardized error envelope: `{ code, message, details, traceId }`

Quality artifacts uploaded by CI:

- Backend: JUnit + coverage reports
- Frontend: Playwright JUnit + HTML report

## Production readiness & Azure deployment

### Production configuration

- Frontend API base URL is now environment-driven via `VITE_API_BASE_URL`.
- Production env templates:
  - `frontend/.env.production.example`
  - `backend/.env.production.example`
- Container images:
  - `frontend/Dockerfile`
  - `backend/Dockerfile`
  - `ml-service/Dockerfile`
- Local production-like orchestration:
  - `docker-compose.prod.yml`

Run locally in production mode:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Azure deployment (Container Apps)

Prepared assets:

- Deployment script: `deploy/azure/deploy.sh`
- Guide: `deploy/azure/README.md`
- Manual GitHub Action: `.github/workflows/deploy-azure.yml`

### Deploy through GitHub Actions (recommended)

1. Add repository secrets:

  - `AZURE_CLIENT_ID`
  - `AZURE_TENANT_ID`
  - `AZ_SUBSCRIPTION_ID`
  - `AZ_LOCATION`
  - `AZ_RESOURCE_GROUP`
  - `AZ_ACR_NAME`
  - `AZ_CONTAINERAPPS_ENV`
  - `AZ_DB_SERVER`
  - `AZ_DB_ADMIN_USER`
  - `AZ_DB_ADMIN_PASSWORD`
  - `JWT_SECRET`

2. Optional secrets (recommended):

  - `CORS_ORIGIN`
  - `AZ_DB_NAME`
  - `BACKEND_APP_NAME`
  - `FRONTEND_APP_NAME`
  - `ML_APP_NAME`

3. Open **Actions** → **Deploy to Azure Container Apps** → **Run workflow**.

The workflow builds Docker images on the runner and pushes directly to ACR (no ACR Tasks dependency), then provisions or updates Container Apps and PostgreSQL resources.

One-time local deployment:

```bash
chmod +x deploy/azure/deploy.sh
./deploy/azure/deploy.sh
```

For required variables and hardening checklist, see `deploy/azure/README.md`.

Current backend coverage thresholds (Vitest):

- Statements: 60%
- Lines: 60%
- Functions: 60%
- Branches: 45%

## API Endpoints (Backend)

- `GET /api/openapi.json`
- `GET /api/metrics`
- `POST /api/expenses`
- `GET /api/expenses?month=YYYY-MM`
- `GET /api/expenses?month=YYYY-MM&page=1&limit=8&search=...&category=Food&sortBy=timestamp|amount&sortOrder=asc|desc`
- `GET /api/expenses/export.csv?month=YYYY-MM&search=...&category=...`
- `DELETE /api/expenses/:id`
- `POST /api/budgets`
- `GET /api/budgets`
- `GET /api/analytics/monthly?month=YYYY-MM`
- `GET /api/prediction?month=YYYY-MM`
- `GET /api/insights?month=YYYY-MM`
- `GET /api/anomalies?month=YYYY-MM`

Performance note:

- Analytics-style endpoints emit `X-Cache: MISS|HIT`
- Cache invalidates automatically when expenses or budgets are changed
- `GET /api/metrics` includes runtime alerts (`ML_FALLBACK_RATE_HIGH`, `AUTH_RATE_LIMIT_SPIKE`, etc.)

Operational alert env vars:

- `ML_FALLBACK_RATE_WARN` (default `0.2`)
- `ERROR_RATE_WARN` (default `0.1`)
- `AUTH_RATE_LIMITED_WARN_COUNT` (default `10`)
- `ML_MODEL_LATENCY_WARN_MS` (default `1000`)

Idempotency note:

- `POST /api/expenses` and `POST /api/budgets` support `Idempotency-Key` header.
- Repeating same request body with same key returns original response (prevents duplicate writes).

Auth endpoints:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

## License

MIT. See `LICENSE`.
