import pg from "pg";
import { config } from "./index.js";
let pool;
const unavailableCodes = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "EPIPE",
  "08001",
  "08003",
  "08006",
  "28P01",
  "3D000",
  "57P01",
  "57P02",
  "57P03",
  "53300",
]);

function unavailable() {
  const error = new Error(
    "The database is temporarily unavailable. Please try again shortly.",
  );
  error.code = "DATABASE_UNAVAILABLE";
  error.statusCode = 503;
  return error;
}

function safeError(error) {
  return unavailableCodes.has(error?.code) ? unavailable() : error;
}

export function getPool() {
  if (!pool) {
    if (!/^postgres(?:ql)?:\/\//i.test(config.database.url || "")) return null;
    try {
      pool = new pg.Pool({
        connectionString: config.database.url,
        max: config.database.poolSize,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        statement_timeout: config.database.statementTimeout || 15000,
        query_timeout: (config.database.statementTimeout || 15000) + 1000,
        idle_in_transaction_session_timeout: 15000,
      });
      pool.on("error", () =>
        console.error("Unexpected PostgreSQL connection error"),
      );
    } catch {
      return null;
    }
  }
  return pool;
}
export async function query(text, values) {
  const database = getPool();
  if (!database) return Promise.reject(unavailable());
  try {
    return await database.query(text, values);
  } catch (error) {
    return Promise.reject(safeError(error));
  }
}
export async function withTransaction(operation) {
  const database = getPool();
  if (!database) return Promise.reject(unavailable());
  let client;
  let releaseError;
  try {
    client = await database.connect();
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        releaseError = rollbackError;
        console.error("Database rollback failed; discarding the connection");
      }
    }
    return Promise.reject(safeError(error));
  } finally {
    client?.release(releaseError);
  }
}
export async function connectDatabase() {
  try {
    await query("SELECT 1");
    console.log("PostgreSQL connected");
    return { success: true };
  } catch {
    console.error(
      "PostgreSQL unavailable. Check DATABASE_URL and the database service.",
    );
    return { success: false, message: unavailable().message };
  }
}
export async function closeDatabase() {
  if (pool) {
    const closingPool = pool;
    pool = undefined;
    try {
      await closingPool.end();
    } catch {
      console.error("Unable to close the PostgreSQL pool cleanly");
    }
  }
}
