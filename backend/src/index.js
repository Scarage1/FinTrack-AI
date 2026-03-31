import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import compression from "compression";
import crypto from "crypto";
import fs from "fs/promises";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import {
  autoCategory,
  groupByCategory,
  groupByDay,
  linearRegressionForecast,
  monthFromTimestamp,
  normalizeMonth
} from "./utils.js";
import {
  buildBudgetAlerts,
  buildSmartInsights,
  getPreviousMonth,
  monthlyTotalsFromAllExpenses
} from "./insights.js";
import { requireAuth, signToken } from "./auth.js";
import { mlCategorize, mlPredict } from "./mlClient.js";
import { closeDb, query, withTransaction } from "./db.js";
import { createApiCache } from "./cache.js";
import { createIdempotencyStore } from "./idempotency.js";
import {
  createAuditLog,
  createExpense,
  createRefreshToken,
  createUser,
  deleteExpenseForUser,
  findActiveRefreshTokenWithUser,
  findUserAuthByEmail,
  findUserIdByEmail,
  listAllExpensesByUser,
  listBudgetsByUser,
  listExpensesByUserAndMonth,
  listExpensesFiltered,
  listExpensesForExport,
  revokeRefreshTokenByHash,
  revokeRefreshTokenById,
  upsertBudget
} from "./repositories.js";
import { apiRateLimit, authRateLimit, checkLoginBlock, clearLoginFailures, recordFailedLogin } from "./security.js";
import {
  validateBudgetBody,
  validateExpenseBody,
  validateExpenseQuery,
  validateIdParam,
  validateLoginBody,
  validateLogoutBody,
  validateRefreshBody,
  validateRegisterBody
} from "./validation.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const apiCache = createApiCache({ defaultTtlMs: 30_000 });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
const idempotencyStore = createIdempotencyStore();
const metrics = {
  requestsTotal: 0,
  errorsTotal: 0,
  totalDurationMs: 0,
  mlPredictionRequests: 0,
  mlFallbackCount: 0,
  mlModelLatencyTotalMs: 0,
  mlModelLatencyCount: 0,
  authRateLimitedCount: 0
};

function getOpsThresholds() {
  return {
    fallbackRateWarn: Number(process.env.ML_FALLBACK_RATE_WARN || 0.2),
    errorRateWarn: Number(process.env.ERROR_RATE_WARN || 0.1),
    authRateLimitedWarnCount: Number(process.env.AUTH_RATE_LIMITED_WARN_COUNT || 10),
    modelLatencyWarnMs: Number(process.env.ML_MODEL_LATENCY_WARN_MS || 1000)
  };
}

function monthRange(month) {
  return `${month}-01`;
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function httpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

function toPositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function toOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function userCachePrefix(userId) {
  return `user:${userId}:`;
}

function cacheKey(userId, endpoint, month) {
  return `${userCachePrefix(userId)}${endpoint}:${month}`;
}

function createTraceId() {
  return crypto.randomUUID();
}

function getIp(req) {
  const raw = req.ip || req.headers["x-forwarded-for"] || "unknown";
  return String(raw).split(",")[0].trim();
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function buildRefreshToken() {
  return crypto.randomBytes(48).toString("base64url");
}

function refreshTokenExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);
  return expiresAt;
}

async function issueRefreshToken(userId, client = null) {
  const refreshToken = buildRefreshToken();
  const tokenHash = hashToken(refreshToken);
  const expiresAt = refreshTokenExpiryDate();

  await createRefreshToken({ userId, tokenHash, expiresAt }, client);
  return refreshToken;
}

async function writeAuditLog({ req, userId = null, action, entity, entityId = null, metadata = null }, client = null) {
  await createAuditLog({
    userId,
    action,
    entity,
    entityId,
    traceId: req.traceId || null,
    ip: getIp(req),
    metadata
  }, client);
}

function csvEscape(value) {
  const raw = String(value ?? "");
  return `"${raw.replaceAll("\"", "\"\"")}"`;
}

function mapExpense(row) {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    amount: Number(row.amount),
    category: row.category,
    description: row.description,
    paymentMethod: row.payment_method,
    timestamp: new Date(row.timestamp).toISOString()
  };
}

function mapBudget(row) {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    category: row.category,
    limit: Number(row.limit_amount)
  };
}

export async function ensureSchema() {
  const schemaPath = path.resolve(__dirname, "../db/schema.sql");
  const sql = await fs.readFile(schemaPath, "utf-8");
  await query(sql);
}

export { app };

const corsOrigins = String(process.env.CORS_ORIGIN || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

app.use(cors(corsOrigins.length ? { origin: corsOrigins } : undefined));
app.use(helmet());
app.use(compression());
app.use((req, res, next) => {
  req.traceId = createTraceId();
  const startedAt = Date.now();
  res.set("X-Trace-Id", req.traceId);

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    metrics.requestsTotal += 1;
    metrics.totalDurationMs += durationMs;
    if (res.statusCode >= 400) metrics.errorsTotal += 1;
    if (res.statusCode === 429 && req.originalUrl.startsWith("/api/auth")) {
      metrics.authRateLimitedCount += 1;
    }

    const log = {
      level: res.statusCode >= 500 ? "error" : "info",
      traceId: req.traceId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      userId: req.user?.id || null
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(log));
  });
  next();
});
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "expense-tracker-backend" });
});

app.get("/api/metrics", (_req, res) => {
  const avgLatencyMs = metrics.requestsTotal > 0
    ? Number((metrics.totalDurationMs / metrics.requestsTotal).toFixed(2))
    : 0;
  const mlFallbackRate = metrics.mlPredictionRequests > 0
    ? Number((metrics.mlFallbackCount / metrics.mlPredictionRequests).toFixed(4))
    : 0;
  const mlModelLatencyAvgMs = metrics.mlModelLatencyCount > 0
    ? Number((metrics.mlModelLatencyTotalMs / metrics.mlModelLatencyCount).toFixed(2))
    : 0;
  const errorRate = metrics.requestsTotal > 0
    ? Number((metrics.errorsTotal / metrics.requestsTotal).toFixed(4))
    : 0;

  const thresholds = getOpsThresholds();
  const alerts = [];

  if (mlFallbackRate >= thresholds.fallbackRateWarn) {
    alerts.push({
      code: "ML_FALLBACK_RATE_HIGH",
      severity: "warn",
      value: mlFallbackRate,
      threshold: thresholds.fallbackRateWarn
    });
  }

  if (errorRate >= thresholds.errorRateWarn) {
    alerts.push({
      code: "ERROR_RATE_HIGH",
      severity: "warn",
      value: errorRate,
      threshold: thresholds.errorRateWarn
    });
  }

  if (metrics.authRateLimitedCount >= thresholds.authRateLimitedWarnCount) {
    alerts.push({
      code: "AUTH_RATE_LIMIT_SPIKE",
      severity: "warn",
      value: metrics.authRateLimitedCount,
      threshold: thresholds.authRateLimitedWarnCount
    });
  }

  if (mlModelLatencyAvgMs >= thresholds.modelLatencyWarnMs) {
    alerts.push({
      code: "ML_MODEL_LATENCY_HIGH",
      severity: "warn",
      value: mlModelLatencyAvgMs,
      threshold: thresholds.modelLatencyWarnMs
    });
  }

  res.json({
    requestsTotal: metrics.requestsTotal,
    errorsTotal: metrics.errorsTotal,
    errorRate,
    avgLatencyMs,
    mlPredictionRequests: metrics.mlPredictionRequests,
    mlFallbackCount: metrics.mlFallbackCount,
    mlFallbackRate,
    mlModelLatencyAvgMs,
    authRateLimitedCount: metrics.authRateLimitedCount,
    alerts
  });
});

app.get("/api/openapi.json", asyncHandler(async (_req, res) => {
  const openApiPath = path.resolve(__dirname, "../openapi.json");
  const raw = await fs.readFile(openApiPath, "utf-8");
  res.type("application/json").send(raw);
}));

app.use("/api", apiRateLimit());
app.use("/api/auth", authRateLimit());

app.post("/api/auth/register", validateRegisterBody, asyncHandler(async (req, res) => {
  const { name = "User", email, password } = req.body;
  if (!email || !password) {
    throw httpError(400, "email and password are required");
  }

  const normalizedEmail = String(email).toLowerCase();
  const exists = await findUserIdByEmail(normalizedEmail);
  if (exists.rowCount > 0) throw httpError(409, "email already exists");

  const passwordHash = await bcrypt.hash(password, 10);
  const inserted = await createUser({ name, email: normalizedEmail, passwordHash });

  const user = inserted.rows[0];
  const userId = Number(user.id);
  const token = signToken({ id: userId, email: user.email, name: user.name });
  const refreshToken = await issueRefreshToken(userId);
  await writeAuditLog({
    req,
    userId,
    action: "AUTH_REGISTER",
    entity: "user",
    entityId: String(userId),
    metadata: { email: user.email }
  });
  return res.status(201).json({
    token,
    refreshToken,
    user: { id: userId, name: user.name, email: user.email }
  });
}));

app.post("/api/auth/login", validateLoginBody, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || "").toLowerCase();
  if (!normalizedEmail || !password) throw httpError(400, "email and password are required");

  const blockState = checkLoginBlock(req, normalizedEmail);
  if (blockState.blocked) {
    return res
      .set("Retry-After", String(blockState.retryAfterSec))
      .status(429)
      .json({
        code: "ACCOUNT_LOCKED",
        message: "too many failed login attempts",
        details: { retryAfterSec: blockState.retryAfterSec }
      });
  }

  const result = await findUserAuthByEmail(normalizedEmail);
  if (result.rowCount === 0) {
    recordFailedLogin(blockState.key);
    throw httpError(401, "invalid credentials");
  }

  const user = result.rows[0];

  const ok = await bcrypt.compare(password || "", user.password_hash);
  if (!ok) {
    recordFailedLogin(blockState.key);
    throw httpError(401, "invalid credentials");
  }

  const userId = Number(user.id);
  const token = signToken({ id: userId, email: user.email, name: user.name });
  const refreshToken = await issueRefreshToken(userId);
  clearLoginFailures(req, normalizedEmail);
  await writeAuditLog({
    req,
    userId,
    action: "AUTH_LOGIN",
    entity: "user",
    entityId: String(userId),
    metadata: { email: user.email }
  });
  return res.json({ token, refreshToken, user: { id: userId, name: user.name, email: user.email } });
}));

app.post("/api/auth/refresh", validateRefreshBody, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const tokenHash = hashToken(refreshToken);

  const result = await withTransaction(async (client) => {
    const tokenRow = await findActiveRefreshTokenWithUser(tokenHash, client);

    if (tokenRow.rowCount === 0) throw httpError(401, "invalid refresh token");

    const row = tokenRow.rows[0];
    await revokeRefreshTokenById(row.id, client);

    const newRefreshToken = await issueRefreshToken(Number(row.user_id), client);
    const accessToken = signToken({ id: Number(row.user_id), email: row.email, name: row.name });

    await writeAuditLog({
      req,
      userId: Number(row.user_id),
      action: "AUTH_REFRESH",
      entity: "session",
      entityId: String(row.id)
    }, client);

    return {
      token: accessToken,
      refreshToken: newRefreshToken,
      user: { id: Number(row.user_id), name: row.name, email: row.email }
    };
  });

  return res.json(result);
}));

app.post("/api/auth/logout", validateLogoutBody, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const tokenHash = hashToken(refreshToken);
  const revoked = await revokeRefreshTokenByHash(tokenHash);

  await writeAuditLog({
    req,
    action: "AUTH_LOGOUT",
    entity: "session",
    metadata: { revoked: revoked.rowCount > 0 }
  });

  return res.status(204).send();
}));

app.use("/api", requireAuth);

app.post("/api/expenses", validateExpenseBody, asyncHandler(async (req, res) => {
  const idempotencyKey = String(req.header("Idempotency-Key") || "").trim();
  const fingerprint = JSON.stringify(req.body || {});
  const cached = idempotencyStore.get({
    scope: `user:${req.user.id}:expenses:create`,
    idempotencyKey,
    fingerprint
  });
  if (cached) return res.status(cached.status).json(cached.body);

  const { amount, category, description = "", paymentMethod = "UPI", timestamp } = req.body;
  if (!amount || Number(amount) <= 0) {
    throw httpError(400, "amount must be greater than 0");
  }

  const mlCategory = !category ? await mlCategorize(description) : null;

  const expense = {
    userId: req.user.id,
    amount: Number(amount),
    category: category || mlCategory || autoCategory(description),
    description,
    paymentMethod,
    timestamp: timestamp || new Date().toISOString()
  };

  const inserted = await createExpense(expense);
  apiCache.delByPrefix(userCachePrefix(req.user.id));
  await writeAuditLog({
    req,
    userId: req.user.id,
    action: "EXPENSE_CREATE",
    entity: "expense",
    entityId: String(inserted.rows[0].id),
    metadata: { amount: expense.amount, category: expense.category }
  });
  const payload = mapExpense(inserted.rows[0]);
  idempotencyStore.set({
    scope: `user:${req.user.id}:expenses:create`,
    idempotencyKey,
    fingerprint,
    value: { status: 201, body: payload }
  });
  return res.status(201).json(payload);
}));

app.get("/api/expenses", validateExpenseQuery, asyncHandler(async (req, res) => {
  const month = normalizeMonth(req.query.month);
  const monthStart = monthRange(month);
  const category = req.query.category ? String(req.query.category) : "";
  const search = req.query.search ? String(req.query.search).trim() : "";
  const minAmount = toOptionalNumber(req.query.minAmount);
  const maxAmount = toOptionalNumber(req.query.maxAmount);
  const page = toPositiveInt(req.query.page, 1);
  const limit = Math.min(100, toPositiveInt(req.query.limit, 10));
  const sortBy = req.query.sortBy === "amount" ? "amount" : "timestamp";
  const sortOrder = String(req.query.sortOrder || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
  const result = await listExpensesFiltered({
    userId: req.user.id,
    monthStart,
    category,
    search,
    minAmount,
    maxAmount,
    page,
    limit,
    sortBy,
    sortOrder
  });

  const items = result.rows.map(mapExpense);
  const total = result.total;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  res.json({
    items,
    page,
    limit,
    total,
    totalPages,
    filters: { month, category, search, minAmount, maxAmount, sortBy, sortOrder: sortOrder.toLowerCase() }
  });
}));

app.get("/api/expenses/export.csv", validateExpenseQuery, asyncHandler(async (req, res) => {
  const month = normalizeMonth(req.query.month);
  const monthStart = monthRange(month);
  const category = req.query.category ? String(req.query.category) : "";
  const search = req.query.search ? String(req.query.search).trim() : "";
  const minAmount = toOptionalNumber(req.query.minAmount);
  const maxAmount = toOptionalNumber(req.query.maxAmount);
  const sortBy = req.query.sortBy === "amount" ? "amount" : "timestamp";
  const sortOrder = String(req.query.sortOrder || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

  const result = await listExpensesForExport({
    userId: req.user.id,
    monthStart,
    category,
    search,
    minAmount,
    maxAmount,
    sortBy,
    sortOrder
  });

  const expenses = result.rows.map(mapExpense);
  const lines = ["id,amount,category,description,paymentMethod,timestamp"];
  for (const e of expenses) {
    lines.push(
      [
        e.id,
        e.amount,
        csvEscape(e.category),
        csvEscape(e.description),
        csvEscape(e.paymentMethod),
        csvEscape(e.timestamp)
      ].join(",")
    );
  }

  return res
    .set("Content-Type", "text/csv; charset=utf-8")
    .set("Content-Disposition", `attachment; filename=expenses-${month}.csv`)
    .status(200)
    .send(lines.join("\n"));
}));

app.delete("/api/expenses/:id", validateIdParam, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const deleted = await deleteExpenseForUser(id, req.user.id);
  if (deleted.rowCount === 0) throw httpError(404, "expense not found");
  apiCache.delByPrefix(userCachePrefix(req.user.id));
  await writeAuditLog({
    req,
    userId: req.user.id,
    action: "EXPENSE_DELETE",
    entity: "expense",
    entityId: String(id)
  });
  return res.status(204).send();
}));

app.post("/api/budgets", validateBudgetBody, asyncHandler(async (req, res) => {
  const idempotencyKey = String(req.header("Idempotency-Key") || "").trim();
  const fingerprint = JSON.stringify(req.body || {});
  const cached = idempotencyStore.get({
    scope: `user:${req.user.id}:budgets:upsert`,
    idempotencyKey,
    fingerprint
  });
  if (cached) return res.status(cached.status).json(cached.body);

  const { category, limit } = req.body;

  const saved = await upsertBudget({ userId: req.user.id, category, limit: Number(limit) });
  apiCache.delByPrefix(userCachePrefix(req.user.id));
  await writeAuditLog({
    req,
    userId: req.user.id,
    action: "BUDGET_UPSERT",
    entity: "budget",
    entityId: String(saved.rows[0].id),
    metadata: { category, limit: Number(limit) }
  });
  const payload = mapBudget(saved.rows[0]);
  idempotencyStore.set({
    scope: `user:${req.user.id}:budgets:upsert`,
    idempotencyKey,
    fingerprint,
    value: { status: 201, body: payload }
  });
  return res.status(201).json(payload);
}));

app.get("/api/budgets", asyncHandler(async (req, res) => {
  const result = await listBudgetsByUser(req.user.id);
  res.json(result.rows.map(mapBudget));
}));

app.get("/api/analytics/monthly", asyncHandler(async (req, res) => {
  const month = normalizeMonth(req.query.month);
  const key = cacheKey(req.user.id, "analytics", month);
  const cached = apiCache.get(key);
  if (cached) return res.set("X-Cache", "HIT").json(cached);

  const monthStart = monthRange(month);
  const result = await listExpensesByUserAndMonth(req.user.id, monthStart);
  const expenses = result.rows.map(mapExpense);
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = groupByCategory(expenses);
  const dailyTrend = groupByDay(expenses);

  const payload = {
    month,
    total,
    count: expenses.length,
    byCategory,
    dailyTrend
  };
  apiCache.set(key, payload);
  return res.set("X-Cache", "MISS").json(payload);
}));

app.get("/api/prediction", asyncHandler(async (req, res) => {
  metrics.mlPredictionRequests += 1;
  const month = normalizeMonth(req.query.month);
  const key = cacheKey(req.user.id, "prediction", month);
  const cached = apiCache.get(key);
  if (cached) return res.set("X-Cache", "HIT").json(cached);

  const all = await listAllExpensesByUser(req.user.id);
  const userExpenses = all.rows.map(mapExpense);
  const currentExpenses = userExpenses.filter((e) => monthFromTimestamp(e.timestamp) === month);
  const currentSpent = currentExpenses.reduce((sum, e) => sum + e.amount, 0);
  const monthlyTotals = monthlyTotalsFromAllExpenses(userExpenses);
  const mlPayload = await mlPredict(monthlyTotals);
  const fallbackMode = mlPayload == null;
  if (fallbackMode) metrics.mlFallbackCount += 1;
  if (!fallbackMode && Number.isFinite(mlPayload?.modelLatencyMs)) {
    metrics.mlModelLatencyTotalMs += Number(mlPayload.modelLatencyMs);
    metrics.mlModelLatencyCount += 1;
  }
  const predictedMonthTotal = mlPayload?.predictedMonthTotal ?? linearRegressionForecast(monthlyTotals);

  const payload = {
    month,
    currentSpent,
    predictedMonthTotal,
    fallbackMode,
    model: fallbackMode ? "linear_baseline" : (mlPayload?.modelVersion || "ml_service"),
    modelVersion: fallbackMode ? null : (mlPayload?.modelVersion || "ml_service"),
    confidence: fallbackMode ? null : mlPayload?.confidence,
    trendSlope: fallbackMode ? null : mlPayload?.trendSlope,
    reasonCode: fallbackMode ? "ML_UNAVAILABLE" : (mlPayload?.reasonCode || "OK"),
    featurePipelineVersion: fallbackMode ? null : mlPayload?.featurePipelineVersion,
    message: `You are likely to spend ₹${predictedMonthTotal} this month`
  };
  apiCache.set(key, payload);
  return res.set("X-Cache", "MISS").json(payload);
}));

app.get("/api/insights", asyncHandler(async (req, res) => {
  const month = normalizeMonth(req.query.month);
  const key = cacheKey(req.user.id, "insights", month);
  const cached = apiCache.get(key);
  if (cached) return res.set("X-Cache", "HIT").json(cached);

  const previousMonth = getPreviousMonth(month);

  const all = await listAllExpensesByUser(req.user.id);
  const userExpenses = all.rows.map(mapExpense);
  const currentMonthExpenses = userExpenses.filter((e) => monthFromTimestamp(e.timestamp) === month);
  const previousMonthExpenses = userExpenses.filter((e) => monthFromTimestamp(e.timestamp) === previousMonth);
  const budgetRows = await listBudgetsByUser(req.user.id);
  const budgets = budgetRows.rows.map(mapBudget);
  const alerts = buildBudgetAlerts(currentMonthExpenses, budgets);
  const insights = buildSmartInsights(currentMonthExpenses, previousMonthExpenses);

  const payload = { month, alerts, insights };
  apiCache.set(key, payload);
  return res.set("X-Cache", "MISS").json(payload);
}));

app.get("/api/anomalies", asyncHandler(async (req, res) => {
  const month = normalizeMonth(req.query.month);
  const key = cacheKey(req.user.id, "anomalies", month);
  const cached = apiCache.get(key);
  if (cached) return res.set("X-Cache", "HIT").json(cached);

  const monthStart = monthRange(month);
  const result = await listExpensesByUserAndMonth(req.user.id, monthStart);
  const expenses = result.rows.map(mapExpense);

  if (expenses.length < 4) {
    const payload = { month, anomalies: [] };
    apiCache.set(key, payload);
    return res.set("X-Cache", "MISS").json(payload);
  }

  const amounts = expenses.map((e) => e.amount);
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const variance = amounts.reduce((acc, value) => acc + (value - mean) ** 2, 0) / amounts.length;
  const std = Math.sqrt(variance);

  const anomalies = expenses
    .filter((e) => (std === 0 ? false : Math.abs((e.amount - mean) / std) >= 2))
    .map((e) => ({
      id: e.id,
      amount: e.amount,
      category: e.category,
      description: e.description,
      timestamp: e.timestamp,
      reason: "Unusually high/low vs monthly spending pattern"
    }));

  const payload = { month, anomalies };
  apiCache.set(key, payload);
  return res.set("X-Cache", "MISS").json(payload);
}));

app.use((err, req, res, _next) => {
  const status = err.status || 500;
  const code = status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR";
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error({ traceId: req.traceId, message: err.message, stack: err.stack });
  }
  res.status(status).json({
    code,
    message: err.message || "internal server error",
    details: err.details || null,
    traceId: req.traceId || null
  });
});

async function start() {
  await ensureSchema();
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend running at http://localhost:${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  start().catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to start backend:", err.message);
    await closeDb();
    process.exit(1);
  });
}
