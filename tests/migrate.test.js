import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import { test, after, mock } from "node:test";

const engine = new PGlite();
let failAfterSchema = false;
mock.module("../config/database.js", {
  namedExports: {
    withTransaction: (operation) =>
      engine.transaction((tx) =>
        operation({
          query: async (sql, values) => {
            // Advisory locks coordinate separate server processes; this engine is single-process.
            if (sql.startsWith("SELECT pg_advisory_xact_lock"))
              return { rows: [] };
            if (
              failAfterSchema &&
              sql.startsWith("INSERT INTO schema_migrations")
            )
              throw new Error("Interrupted migration");
            return values ? tx.query(sql, values) : tx.exec(sql);
          },
        }),
      ),
    closeDatabase: async () => {},
  },
});
const { migrate } = await import("../db/migrate.js");
after(() => engine.close());

test("migration rolls back DDL, applies once, and detects modified history", async () => {
  failAfterSchema = true;
  await assert.rejects(migrate(), /Interrupted migration/);
  assert.equal(
    (await engine.query("SELECT to_regclass('public.users') AS table_name"))
      .rows[0].table_name,
    null,
  );
  failAfterSchema = false;
  await migrate();
  await migrate();
  assert.equal(
    Number(
      (await engine.query("SELECT count(*) FROM schema_migrations")).rows[0]
        .count,
    ),
    2,
  );
  assert.ok(
    (await engine.query("SELECT to_regclass('public.users') AS table_name"))
      .rows[0].table_name,
  );
  await engine.query("UPDATE schema_migrations SET checksum='changed'");
  await assert.rejects(migrate(), /Applied migration changed/);
});
