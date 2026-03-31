import { performance } from "node:perf_hooks";
import fs from "node:fs/promises";
import path from "node:path";
import request from "supertest";

process.env.NODE_ENV = "test";

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

function monthString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function randomEmail() {
  return `perf_${Date.now()}_${Math.floor(Math.random() * 100000)}@example.com`;
}

async function timed(operation) {
  const start = performance.now();
  await operation();
  return performance.now() - start;
}

async function main() {
  const { app, ensureSchema } = await import("../src/index.js");
  const { closeDb, query } = await import("../src/db.js");

  const p95MaxMs = Number(process.env.PERF_P95_MAX_MS || 300);
  const failOnAlerts = String(process.env.PERF_FAIL_ON_ALERTS || "true").toLowerCase() === "true";
  const blockingAlertCodes = String(process.env.PERF_BLOCKING_ALERT_CODES || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const email = randomEmail();
  const password = "password123";

  try {
    await ensureSchema();

    await request(app)
      .post("/api/auth/register")
      .send({ name: "Perf User", email, password })
      .expect(201);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password })
      .expect(200);

    const token = login.body.token;
    const auth = { Authorization: `Bearer ${token}` };

    for (let i = 0; i < 40; i += 1) {
      await request(app)
        .post("/api/expenses")
        .set(auth)
        .send({ amount: 100 + i, description: `Perf seed ${i}`, paymentMethod: "UPI" })
        .expect(201);
    }

    const month = monthString();
    const durations = [];

    for (let i = 0; i < 80; i += 1) {
      durations.push(
        await timed(async () => {
          await request(app)
            .get(`/api/expenses?month=${month}&limit=10&page=1`)
            .set(auth)
            .expect(200);
        })
      );

      durations.push(
        await timed(async () => {
          await request(app)
            .get(`/api/analytics/monthly?month=${month}`)
            .set(auth)
            .expect(200);
        })
      );
    }

    const p95 = Number(percentile(durations, 95).toFixed(2));
    const avg = Number((durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2));
    const metricsRes = await request(app).get("/api/metrics").expect(200);
    const alerts = Array.isArray(metricsRes.body?.alerts) ? metricsRes.body.alerts : [];

    const blockingAlerts = blockingAlertCodes.length
      ? alerts.filter((a) => blockingAlertCodes.includes(String(a.code)))
      : alerts;

    const failed = p95 > p95MaxMs || (failOnAlerts && blockingAlerts.length > 0);

    const report = {
      check: "backend-perf-smoke",
      requests: durations.length,
      avgMs: avg,
      p95Ms: p95,
      thresholdMs: p95MaxMs,
      failOnAlerts,
      blockingAlertCodes,
      alerts,
      status: failed ? "fail" : "pass"
    };

    await fs.mkdir(path.resolve("test-results"), { recursive: true });
    await fs.writeFile(path.resolve("test-results/perf-smoke.json"), JSON.stringify(report, null, 2), "utf-8");

    console.log(JSON.stringify(report, null, 2));

    if (failed) {
      process.exitCode = 1;
    }
  } finally {
    await query("DELETE FROM users WHERE email = $1", [email]);
    await closeDb();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
