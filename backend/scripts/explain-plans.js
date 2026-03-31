import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { closeDb, withTransaction } from "../src/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function monthStart(month) {
  return `${month}-01`;
}

function flattenNodeTypes(node, set = new Set()) {
  if (!node) return set;
  if (node["Node Type"]) set.add(node["Node Type"]);
  for (const child of node.Plans || []) {
    flattenNodeTypes(child, set);
  }
  return set;
}

async function explain(client, label, sql, params) {
  const result = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, params);
  const explainJson = result.rows[0]["QUERY PLAN"][0];
  const planRoot = explainJson.Plan;

  return {
    label,
    planningTimeMs: explainJson["Planning Time"],
    executionTimeMs: explainJson["Execution Time"],
    totalCost: planRoot["Total Cost"],
    planRows: planRoot["Plan Rows"],
    nodeTypes: Array.from(flattenNodeTypes(planRoot)).sort()
  };
}

async function main() {
  const month = process.env.EXPLAIN_MONTH || "2026-03";
  const sampleSize = Number(process.env.EXPLAIN_SAMPLE_SIZE || 400);
  const maxExecMs = Number(process.env.EXPLAIN_MAX_EXEC_MS || 25);
  const email = `plan_probe_${Date.now()}@expense.app`;

  const report = await withTransaction(async (client) => {
    const userInsert = await client.query(
      "INSERT INTO users(name, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      ["Plan Probe", email, "not-used"]
    );
    const userId = Number(userInsert.rows[0].id);

    for (let i = 0; i < sampleSize; i += 1) {
      const category = i % 2 === 0 ? "Food" : "Travel";
      const description = i % 2 === 0 ? `swiggy order ${i}` : `uber ride ${i}`;
      await client.query(
        `INSERT INTO expenses(user_id, amount, category, description, payment_method, timestamp)
         VALUES ($1, $2, $3, $4, $5, ($6::date + (($7 % 28)) * INTERVAL '1 day'))`,
        [userId, 100 + i, category, description, "UPI", monthStart(month), i]
      );
    }

    const probes = [];

    probes.push(
      await explain(
        client,
        "month-list-timestamp-desc",
        `SELECT * FROM expenses
         WHERE user_id = $1
           AND timestamp >= $2::date
           AND timestamp < ($2::date + INTERVAL '1 month')
         ORDER BY timestamp DESC
         LIMIT 20 OFFSET 0`,
        [userId, monthStart(month)]
      )
    );

    probes.push(
      await explain(
        client,
        "month-category-filter",
        `SELECT * FROM expenses
         WHERE user_id = $1
           AND timestamp >= $2::date
           AND timestamp < ($2::date + INTERVAL '1 month')
           AND category = $3
         ORDER BY timestamp DESC
         LIMIT 20 OFFSET 0`,
        [userId, monthStart(month), "Food"]
      )
    );

    probes.push(
      await explain(
        client,
        "month-search-filter",
        `SELECT * FROM expenses
         WHERE user_id = $1
           AND timestamp >= $2::date
           AND timestamp < ($2::date + INTERVAL '1 month')
           AND (description ILIKE $3 OR category ILIKE $3)
         ORDER BY timestamp DESC
         LIMIT 20 OFFSET 0`,
        [userId, monthStart(month), "%swiggy%"]
      )
    );

    return probes;
  });

  const failures = report
    .filter((probe) => Number(probe.executionTimeMs) > maxExecMs)
    .map((probe) => ({
      label: probe.label,
      reason: "EXECUTION_TIME_HIGH",
      valueMs: Number(probe.executionTimeMs),
      thresholdMs: maxExecMs
    }));

  const finalReport = {
    check: "db-query-plan-smoke",
    month,
    sampleSize,
    thresholdMs: maxExecMs,
    probes: report,
    failures,
    status: failures.length ? "fail" : "pass",
    generatedAt: new Date().toISOString()
  };

  const outputDir = path.resolve(__dirname, "../test-results");
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "query-plans.json");
  await fs.writeFile(outputPath, JSON.stringify(finalReport, null, 2), "utf-8");

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(finalReport, null, 2));

  if (failures.length > 0) {
    throw new Error(`DB query plan smoke failed (${failures.length} probe(s) exceeded threshold)`);
  }
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to run query plan smoke:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
