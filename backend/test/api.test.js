import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, ensureSchema } from "../src/index.js";
import { closeDb, query } from "../src/db.js";
import { resetSecurityState } from "../src/security.js";

function uniqueEmail() {
  return `vitest_${Date.now()}_${Math.floor(Math.random() * 100000)}@example.com`;
}

async function registerAndLogin() {
  const email = uniqueEmail();
  const password = "password123";

  const registerRes = await request(app).post("/api/auth/register").send({
    name: "Vitest User",
    email,
    password
  });

  expect(registerRes.status).toBe(201);
  expect(registerRes.body.token).toBeTruthy();

  const loginRes = await request(app).post("/api/auth/login").send({ email, password });
  expect(loginRes.status).toBe(200);
  return { token: loginRes.body.token, email };
}

beforeAll(async () => {
  await ensureSchema();
  await query("DELETE FROM users WHERE email LIKE 'vitest_%@example.com'");
});

beforeEach(() => {
  resetSecurityState();
  delete process.env.AUTH_RATE_LIMIT_MAX;
  delete process.env.AUTH_RATE_LIMIT_WINDOW_MS;
  delete process.env.LOGIN_LOCK_MAX_ATTEMPTS;
  delete process.env.LOGIN_LOCK_WINDOW_MS;
  delete process.env.LOGIN_LOCK_MS;
});

afterAll(async () => {
  await query("DELETE FROM users WHERE email LIKE 'vitest_%@example.com'");
  await closeDb();
});

describe("API", () => {
  it("returns health", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("returns metrics", async () => {
    const res = await request(app).get("/api/metrics");
    expect(res.status).toBe(200);
    expect(typeof res.body.requestsTotal).toBe("number");
    expect(typeof res.body.avgLatencyMs).toBe("number");
    expect(Array.isArray(res.body.alerts)).toBe(true);
  });

  it("returns openapi contract", async () => {
    const res = await request(app).get("/api/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.0.3");
    expect(res.body.paths["/api/expenses"]).toBeTruthy();
  });

  it("registers and logs in", async () => {
    const email = uniqueEmail();
    const password = "password123";

    const registerRes = await request(app).post("/api/auth/register").send({ name: "A", email, password });
    expect(registerRes.status).toBe(201);

    const loginRes = await request(app).post("/api/auth/login").send({ email, password });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeTruthy();
  });

  it("validates register payload", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "",
      email: "not-an-email",
      password: "123"
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("REQUEST_ERROR");
    expect(res.body.message).toBe("validation failed");
  });

  it("rejects weak password on register", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Weak",
      email: uniqueEmail(),
      password: "short"
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("REQUEST_ERROR");
  });

  it("blocks protected route without token", async () => {
    const res = await request(app).get("/api/expenses");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTH_ERROR");
  });

  it("rejects tampered access token", async () => {
    const { token } = await registerAndLogin();
    const res = await request(app).get("/api/expenses").set("Authorization", `Bearer ${token}tampered`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTH_ERROR");
  });

  it("creates and lists expenses with filters + pagination", async () => {
    const { token } = await registerAndLogin();

    await request(app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 500, description: "Uber ride", paymentMethod: "Card" })
      .expect(201);

    await request(app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 250, description: "Swiggy lunch", paymentMethod: "UPI" })
      .expect(201);

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const listRes = await request(app)
      .get(`/api/expenses?month=${month}&search=swiggy&limit=1&page=1&sortBy=amount&sortOrder=desc`)
      .set("Authorization", `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.items)).toBe(true);
    expect(listRes.body.items.length).toBe(1);
    expect(listRes.body.total).toBeGreaterThanOrEqual(1);
  });

  it("prevents deleting another user's expense", async () => {
    const { token: tokenA } = await registerAndLogin();
    const { token: tokenB } = await registerAndLogin();

    const created = await request(app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ amount: 220, description: "Owner expense", paymentMethod: "UPI" })
      .expect(201);

    await request(app)
      .delete(`/api/expenses/${created.body.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);
  });

  it("applies idempotency for expense creation", async () => {
    const { token } = await registerAndLogin();
    const idempotencyKey = `idem-${Date.now()}`;
    const payload = { amount: 888, description: "Idempotent expense", paymentMethod: "UPI" };

    const first = await request(app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", idempotencyKey)
      .send(payload)
      .expect(201);

    const second = await request(app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", idempotencyKey)
      .send(payload)
      .expect(201);

    expect(second.body.id).toBe(first.body.id);

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const list = await request(app)
      .get(`/api/expenses?month=${month}&search=Idempotent expense`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(list.body.total).toBe(1);
  });

  it("returns structured error for invalid expense id", async () => {
    const { token } = await registerAndLogin();
    const res = await request(app).delete("/api/expenses/abc").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("REQUEST_ERROR");
    expect(res.body.message).toContain("validation failed");
  });

  it("exports filtered expenses as csv", async () => {
    const { token } = await registerAndLogin();

    await request(app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 410, description: "Coffee export test", paymentMethod: "UPI" })
      .expect(201);

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const csvRes = await request(app)
      .get(`/api/expenses/export.csv?month=${month}&search=coffee`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(csvRes.headers["content-type"]).toContain("text/csv");
    expect(csvRes.text).toContain("id,amount,category,description,paymentMethod,timestamp");
    expect(csvRes.text.toLowerCase()).toContain("coffee export test");
  });

  it("upserts budgets and returns analytics", async () => {
    const { token } = await registerAndLogin();

    await request(app)
      .post("/api/budgets")
      .set("Authorization", `Bearer ${token}`)
      .send({ category: "Food", limit: 3000 })
      .expect(201);

    await request(app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 700, description: "Swiggy dinner", paymentMethod: "UPI" })
      .expect(201);

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const analyticsRes = await request(app)
      .get(`/api/analytics/monthly?month=${month}`)
      .set("Authorization", `Bearer ${token}`);

    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.total).toBeGreaterThan(0);

    const insightsRes = await request(app)
      .get(`/api/insights?month=${month}`)
      .set("Authorization", `Bearer ${token}`);

    expect(insightsRes.status).toBe(200);
    expect(Array.isArray(insightsRes.body.alerts)).toBe(true);

    const predictionRes = await request(app)
      .get(`/api/prediction?month=${month}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(predictionRes.body.predictedMonthTotal).toBeTypeOf("number");
    expect(predictionRes.body.reasonCode).toBeTruthy();
    expect(Object.hasOwn(predictionRes.body, "confidence")).toBe(true);
  });

  it("returns exact analytics totals and category split", async () => {
    const { token } = await registerAndLogin();

    await request(app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 100, category: "Food", description: "Meal", paymentMethod: "UPI" })
      .expect(201);

    await request(app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 200, category: "Travel", description: "Cab", paymentMethod: "Card" })
      .expect(201);

    await request(app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 300, category: "Food", description: "Dinner", paymentMethod: "UPI" })
      .expect(201);

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const analyticsRes = await request(app)
      .get(`/api/analytics/monthly?month=${month}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(analyticsRes.body.total).toBe(600);
    expect(Number(analyticsRes.body.byCategory.Food || 0)).toBe(400);
    expect(Number(analyticsRes.body.byCategory.Travel || 0)).toBe(200);
  });

  it("detects expected anomaly outlier", async () => {
    const { token } = await registerAndLogin();

    const basePayloads = [100, 102, 98, 101, 99, 103, 97, 100, 101, 99].map((amount) => ({
      amount,
      category: "Food",
      description: `normal-${amount}`,
      paymentMethod: "UPI"
    }));

    for (const payload of basePayloads) {
      await request(app).post("/api/expenses").set("Authorization", `Bearer ${token}`).send(payload).expect(201);
    }

    const outlier = await request(app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 5000, category: "Food", description: "outlier-expense", paymentMethod: "UPI" })
      .expect(201);

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const anomalies = await request(app)
      .get(`/api/anomalies?month=${month}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(anomalies.body.anomalies)).toBe(true);
    expect(anomalies.body.anomalies.some((a) => a.id === outlier.body.id)).toBe(true);
  });

  it("caches analytics and invalidates after new expense", async () => {
    const { token } = await registerAndLogin();
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    await request(app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 300, description: "Cafe", paymentMethod: "UPI" })
      .expect(201);

    const first = await request(app)
      .get(`/api/analytics/monthly?month=${month}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(first.headers["x-cache"]).toBe("MISS");

    const second = await request(app)
      .get(`/api/analytics/monthly?month=${month}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(second.headers["x-cache"]).toBe("HIT");

    await request(app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({ amount: 350, description: "Dinner", paymentMethod: "Card" })
      .expect(201);

    const third = await request(app)
      .get(`/api/analytics/monthly?month=${month}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(third.headers["x-cache"]).toBe("MISS");
  });

  it("rate limits auth endpoint", async () => {
    process.env.AUTH_RATE_LIMIT_MAX = "2";
    process.env.AUTH_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.AUTH_RATE_LIMITED_WARN_COUNT = "1";

    await request(app).post("/api/auth/login").send({ email: uniqueEmail(), password: "x" }).expect(401);
    await request(app).post("/api/auth/login").send({ email: uniqueEmail(), password: "x" }).expect(401);

    const limited = await request(app)
      .post("/api/auth/login")
      .send({ email: uniqueEmail(), password: "x" })
      .expect(429);

    expect(limited.body.code).toBe("RATE_LIMITED");
    expect(limited.headers["retry-after"]).toBeTruthy();

    const metricsRes = await request(app).get("/api/metrics").expect(200);
    expect(metricsRes.body.alerts.some((a) => a.code === "AUTH_RATE_LIMIT_SPIKE")).toBe(true);
  });

  it("enforces DB check constraint for negative amount", async () => {
    const email = uniqueEmail();
    const created = await query(
      "INSERT INTO users(name, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      ["Constraint User", email, "hash"]
    );
    const userId = Number(created.rows[0].id);

    await expect(
      query(
        `INSERT INTO expenses(user_id, amount, category, description, payment_method, timestamp)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [userId, -10, "Food", "invalid", "UPI"]
      )
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("cascades expense and budget rows when user is deleted", async () => {
    const email = uniqueEmail();
    const created = await query(
      "INSERT INTO users(name, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      ["Cascade User", email, "hash"]
    );
    const userId = Number(created.rows[0].id);

    await query(
      `INSERT INTO expenses(user_id, amount, category, description, payment_method, timestamp)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, 50, "Food", "cascade-expense", "UPI"]
    );
    await query(
      `INSERT INTO budgets(user_id, category, limit_amount)
       VALUES ($1, $2, $3)`,
      [userId, "Food", 500]
    );

    await query("DELETE FROM users WHERE id = $1", [userId]);

    const expenseCount = await query("SELECT COUNT(*)::int AS count FROM expenses WHERE user_id = $1", [userId]);
    const budgetCount = await query("SELECT COUNT(*)::int AS count FROM budgets WHERE user_id = $1", [userId]);

    expect(expenseCount.rows[0].count).toBe(0);
    expect(budgetCount.rows[0].count).toBe(0);
  });

  it("handles concurrent budget upserts for same category", async () => {
    const { token } = await registerAndLogin();
    const limits = [1000, 1100, 1200, 1300, 1400, 1500];

    await Promise.all(
      limits.map((limit, idx) =>
        request(app)
          .post("/api/budgets")
          .set("Authorization", `Bearer ${token}`)
          .set("Idempotency-Key", `budget-concurrent-${Date.now()}-${idx}`)
          .send({ category: "Food", limit })
          .expect(201)
      )
    );

    const budgets = await request(app).get("/api/budgets").set("Authorization", `Bearer ${token}`).expect(200);
    const foodBudgets = budgets.body.filter((b) => b.category === "Food");

    expect(foodBudgets.length).toBe(1);
    expect(limits).toContain(Number(foodBudgets[0].limit));
  });

  it("locks login after repeated failed attempts", async () => {
    process.env.AUTH_RATE_LIMIT_MAX = "100";
    process.env.LOGIN_LOCK_MAX_ATTEMPTS = "2";
    process.env.LOGIN_LOCK_WINDOW_MS = "60000";
    process.env.LOGIN_LOCK_MS = "60000";

    const email = uniqueEmail();
    const password = "password123";
    await request(app).post("/api/auth/register").send({ name: "Lock User", email, password }).expect(201);

    await request(app).post("/api/auth/login").send({ email, password: "wrong-1" }).expect(401);
    await request(app).post("/api/auth/login").send({ email, password: "wrong-2" }).expect(401);

    const locked = await request(app).post("/api/auth/login").send({ email, password }).expect(429);

    expect(locked.body.code).toBe("ACCOUNT_LOCKED");
    expect(locked.headers["retry-after"]).toBeTruthy();
  });

  it("rotates refresh tokens and invalidates old token", async () => {
    const email = uniqueEmail();
    const password = "password123";

    const registerRes = await request(app).post("/api/auth/register").send({ name: "Refresh User", email, password });
    expect(registerRes.status).toBe(201);
    expect(registerRes.body.refreshToken).toBeTruthy();

    const refresh1 = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: registerRes.body.refreshToken })
      .expect(200);

    expect(refresh1.body.token).toBeTruthy();
    expect(refresh1.body.refreshToken).toBeTruthy();
    expect(refresh1.body.refreshToken).not.toBe(registerRes.body.refreshToken);

    await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: registerRes.body.refreshToken })
      .expect(401);

    await request(app)
      .post("/api/auth/logout")
      .send({ refreshToken: refresh1.body.refreshToken })
      .expect(204);

    await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: refresh1.body.refreshToken })
      .expect(401);
  });
});
