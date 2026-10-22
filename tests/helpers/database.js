import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { mock } from "node:test";
export async function testDatabase() {
  const engine = new PGlite();
  const directory = new URL("../../db/migrations/", import.meta.url);
  for (const name of (await readdir(directory))
    .filter((name) => name.endsWith(".sql"))
    .sort())
    await engine.exec(await readFile(new URL(name, directory), "utf8"));
  await engine.exec(
    "CREATE TABLE schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const adapt = (connection) => ({
    query: async (text, values) => {
      const result = await connection.query(text, values);
      return { ...result, rowCount: result.affectedRows ?? result.rows.length };
    },
  });
  const db = adapt(engine);
  mock.module("../../config/database.js", {
    namedExports: {
      query: db.query,
      withTransaction: (operation) =>
        engine.transaction((tx) => operation(adapt(tx))),
      connectDatabase: async () => {},
      closeDatabase: async () => {},
    },
  });
  return {
    ...db,
    engine,
    reset: () =>
      engine.exec(
        "TRUNCATE payment_transactions,conversations,project_versions,projects,users CASCADE",
      ),
  };
}
