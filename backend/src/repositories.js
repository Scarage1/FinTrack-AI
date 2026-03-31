import { query } from "./db.js";

function getRunner(runner) {
  return runner || { query };
}

function buildExpenseWhere({ userId, monthStart, category, search, minAmount, maxAmount }) {
  const where = [
    "user_id = $1",
    "timestamp >= $2::date",
    "timestamp < ($2::date + INTERVAL '1 month')"
  ];
  const params = [userId, monthStart];

  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(description ILIKE $${params.length} OR category ILIKE $${params.length})`);
  }
  if (Number.isFinite(minAmount)) {
    params.push(minAmount);
    where.push(`amount >= $${params.length}`);
  }
  if (Number.isFinite(maxAmount)) {
    params.push(maxAmount);
    where.push(`amount <= $${params.length}`);
  }

  return { whereClause: where.join(" AND "), params };
}

export async function findUserIdByEmail(email, runner) {
  const db = getRunner(runner);
  return db.query("SELECT id FROM users WHERE email = $1", [email]);
}

export async function createUser({ name, email, passwordHash }, runner) {
  const db = getRunner(runner);
  return db.query(
    "INSERT INTO users(name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email",
    [name, email, passwordHash]
  );
}

export async function findUserAuthByEmail(email, runner) {
  const db = getRunner(runner);
  return db.query("SELECT id, name, email, password_hash FROM users WHERE email = $1", [email]);
}

export async function createRefreshToken({ userId, tokenHash, expiresAt }, runner) {
  const db = getRunner(runner);
  return db.query(
    `INSERT INTO refresh_tokens(user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
}

export async function findActiveRefreshTokenWithUser(tokenHash, runner) {
  const db = getRunner(runner);
  return db.query(
    `SELECT rt.id, rt.user_id, u.name, u.email
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1
       AND rt.revoked_at IS NULL
       AND rt.expires_at > NOW()
     FOR UPDATE`,
    [tokenHash]
  );
}

export async function revokeRefreshTokenById(id, runner) {
  const db = getRunner(runner);
  return db.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1", [id]);
}

export async function revokeRefreshTokenByHash(tokenHash, runner) {
  const db = getRunner(runner);
  return db.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE token_hash = $1
       AND revoked_at IS NULL`,
    [tokenHash]
  );
}

export async function createAuditLog({ userId, action, entity, entityId, traceId, ip, metadata }, runner) {
  const db = getRunner(runner);
  return db.query(
    `INSERT INTO audit_logs(user_id, action, entity, entity_id, trace_id, ip, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [userId, action, entity, entityId, traceId, ip, metadata ? JSON.stringify(metadata) : null]
  );
}

export async function createExpense({ userId, amount, category, description, paymentMethod, timestamp }, runner) {
  const db = getRunner(runner);
  return db.query(
    `INSERT INTO expenses(user_id, amount, category, description, payment_method, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, amount, category, description, paymentMethod, timestamp]
  );
}

export async function listExpensesFiltered({
  userId,
  monthStart,
  category,
  search,
  minAmount,
  maxAmount,
  page,
  limit,
  sortBy,
  sortOrder
}, runner) {
  const db = getRunner(runner);
  const offset = (page - 1) * limit;
  const { whereClause, params } = buildExpenseWhere({ userId, monthStart, category, search, minAmount, maxAmount });

  const totalResult = await db.query(`SELECT COUNT(*)::int AS count FROM expenses WHERE ${whereClause}`, params);
  const total = totalResult.rows[0].count;

  const listParams = [...params, limit, offset];
  const result = await db.query(
    `SELECT * FROM expenses
     WHERE ${whereClause}
     ORDER BY ${sortBy} ${sortOrder}
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  return { rows: result.rows, total };
}

export async function listExpensesForExport({ userId, monthStart, category, search, minAmount, maxAmount, sortBy, sortOrder }, runner) {
  const db = getRunner(runner);
  const { whereClause, params } = buildExpenseWhere({ userId, monthStart, category, search, minAmount, maxAmount });
  return db.query(
    `SELECT * FROM expenses
     WHERE ${whereClause}
     ORDER BY ${sortBy} ${sortOrder}`,
    params
  );
}

export async function deleteExpenseForUser(id, userId, runner) {
  const db = getRunner(runner);
  return db.query("DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId]);
}

export async function upsertBudget({ userId, category, limit }, runner) {
  const db = getRunner(runner);
  return db.query(
    `INSERT INTO budgets(user_id, category, limit_amount)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, category)
     DO UPDATE SET limit_amount = EXCLUDED.limit_amount, updated_at = NOW()
     RETURNING *`,
    [userId, category, Number(limit)]
  );
}

export async function listBudgetsByUser(userId, runner) {
  const db = getRunner(runner);
  return db.query("SELECT * FROM budgets WHERE user_id = $1 ORDER BY category", [userId]);
}

export async function listExpensesByUserAndMonth(userId, monthStart, runner) {
  const db = getRunner(runner);
  return db.query(
    `SELECT * FROM expenses
     WHERE user_id = $1
       AND timestamp >= $2::date
       AND timestamp < ($2::date + INTERVAL '1 month')
     ORDER BY timestamp`,
    [userId, monthStart]
  );
}

export async function listAllExpensesByUser(userId, runner) {
  const db = getRunner(runner);
  return db.query("SELECT * FROM expenses WHERE user_id = $1 ORDER BY timestamp", [userId]);
}
