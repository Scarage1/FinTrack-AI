import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { closeDb, query } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const schemaPath = path.resolve(__dirname, "../db/schema.sql");
  const sql = await fs.readFile(schemaPath, "utf-8");
  await query(sql);
  // eslint-disable-next-line no-console
  console.log("Database schema initialized successfully");
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to initialize DB:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
