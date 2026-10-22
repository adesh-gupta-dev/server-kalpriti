import { query } from "../config/database.js";
import { productionConfigurationIssues } from "../config/security.js";
import { rateLimitStoreReady } from "../utils/rateLimiter.js";

export const liveness = (_req, res) =>
  res.json({ ok: true, service: "kalpriti-api" });
export async function readiness(_req, res) {
  let database = false;
  try {
    const result = await query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='session_version') AND to_regclass('public.projects') IS NOT NULL AND to_regclass('public.project_versions') IS NOT NULL AND to_regclass('public.conversations') IS NOT NULL AND to_regclass('public.payment_transactions') IS NOT NULL AND to_regclass('public.schema_migrations') IS NOT NULL AS ready",
    );
    database = result.rows[0]?.ready === true;
  } catch {
    /* Outages are an expected readiness state, not a process failure. */
  }
  const configuration = productionConfigurationIssues().length === 0;
  const rateLimitStore = await rateLimitStoreReady();
  const ok = database && configuration && rateLimitStore;
  res
    .status(ok ? 200 : 503)
    .json({
      ok,
      service: "kalpriti-api",
      checks: { database, configuration, rateLimitStore },
    });
}
