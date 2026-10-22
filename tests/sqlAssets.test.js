import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("standalone schema installs complete tables and matching migration history; DML retains no fixtures", async () => {
  const engine = new PGlite();
  try {
    // The embedded engine runs one process; cross-process advisory locking is tested on PostgreSQL.
    const schema = (await read("../db/schema.sql")).replace(
      "SELECT pg_advisory_xact_lock(527113204);",
      "",
    );
    await engine.exec(schema);
    const migration = await read("../db/migrations/001_initial.sql");
    const applied = (
      await engine.query("SELECT name, checksum FROM schema_migrations")
    ).rows;
    assert.deepEqual(applied, [
      {
        name: "001_initial.sql",
        checksum: createHash("sha256").update(migration).digest("hex"),
      },
      {
        name: "002_session_version.sql",
        checksum: createHash("sha256").update(await read("../db/migrations/002_session_version.sql")).digest("hex"),
      },
    ]);
    await engine.exec(await read("../db/dml/examples.sql"));
    for (const table of [
      "users",
      "projects",
      "project_versions",
      "conversations",
      "payment_transactions",
    ]) {
      assert.equal(
        Number(
          (await engine.query(`SELECT count(*) FROM ${table}`)).rows[0].count,
        ),
        0,
      );
    }
    // An attempted SQL snapshot reinstallation must fail rather than overwrite data/history.
    await assert.rejects(engine.exec(schema), /already exists/);
    await engine.exec("ROLLBACK");
    assert.equal(
      Number(
        (await engine.query("SELECT count(*) FROM schema_migrations")).rows[0]
          .count,
      ),
      2,
    );
  } finally {
    await engine.close();
  }
});

test("DCL roles separate runtime writes and reporting access without exposing user secrets", async () => {
  const engine = new PGlite();
  try {
    await engine.exec(await read("../db/migrations/001_initial.sql"));
    await engine.exec(
      "CREATE TABLE schema_migrations(name text PRIMARY KEY, checksum text, applied_at timestamptz DEFAULT now())",
    );
    await engine.exec(await read("../db/dcl/roles.sql"));
    await engine.exec(await read("../db/dcl/roles.sql"));
    await engine.exec("SET ROLE kalpriti_runtime");
    await engine.query("SELECT * FROM users");
    await engine.query("UPDATE users SET credits=credits WHERE false");
    await assert.rejects(
      engine.query("DELETE FROM schema_migrations"),
      /permission denied/,
    );
    await assert.rejects(
      engine.query("CREATE TABLE public.forbidden(id text)"),
      /permission denied/,
    );
    await engine.exec("RESET ROLE; SET ROLE kalpriti_readonly");
    await engine.query("SELECT id,email,credits FROM users");
    await engine.query("SELECT * FROM payment_transactions");
    await assert.rejects(
      engine.query("SELECT password FROM users"),
      /permission denied/,
    );
    await assert.rejects(
      engine.query("SELECT otp_hash,reset_token FROM users"),
      /permission denied/,
    );
    await assert.rejects(
      engine.query("UPDATE users SET credits=0"),
      /permission denied/,
    );
    await engine.exec("RESET ROLE");
  } finally {
    await engine.close();
  }
});
