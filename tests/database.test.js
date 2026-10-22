import assert from "node:assert/strict";
import { beforeEach, test, mock } from "node:test";
import express from "express";
import { once } from "node:events";
import { asyncErrorHandler } from "../middleware/asyncErrorHandler.js";
import { handleError } from "../middleware/errorMiddleware.js";

const config = {
  database: { url: "postgresql://test.invalid/example", poolSize: 2 },
};
let calls, connectError, queryError, rollbackError, released;
const client = {
  query: async (sql) => {
    calls.push(sql);
    if (sql === "ROLLBACK" && rollbackError)
      return Promise.reject(rollbackError);
    return { rows: [], rowCount: 0 };
  },
  release: (error) => {
    released = { error };
  },
};
mock.module("../config/index.js", { namedExports: { config } });
mock.module("pg", {
  defaultExport: {
    Pool: class {
      on() {}
      async connect() {
        return connectError ? Promise.reject(connectError) : client;
      }
      async query() {
        return queryError ? Promise.reject(queryError) : { rows: [{ ok: 1 }] };
      }
      async end() {}
    },
  },
});
const database = await import("../config/database.js");
beforeEach(async () => {
  await database.closeDatabase();
  config.database.url = "postgresql://test.invalid/example";
  calls = [];
  connectError = queryError = rollbackError = released = undefined;
});

test("invalid configuration becomes a handled failure and does not synchronously throw", async () => {
  config.database.url = "mongodb://legacy.invalid/database";
  assert.equal(database.getPool(), null);
  await assert.rejects(database.query("SELECT 1"), {
    code: "DATABASE_UNAVAILABLE",
    statusCode: 503,
  });
  assert.equal((await database.connectDatabase()).success, false);
});

test("unavailable connections produce a safe 503 without leaking connection details", async () => {
  queryError = Object.assign(new Error("password=private host=private"), {
    code: "ECONNREFUSED",
  });
  await assert.rejects(
    database.query("SELECT 1"),
    (error) => error.statusCode === 503 && !error.message.includes("private"),
  );
  connectError = queryError;
  await assert.rejects(
    database.withTransaction(async () => assert.fail("must not execute")),
    { statusCode: 503 },
  );
  assert.equal(released, undefined);
});

test("transactions commit only successful operations and always release the client", async () => {
  assert.equal(await database.withTransaction(async () => 42), 42);
  assert.deepEqual(calls, ["BEGIN", "COMMIT"]);
  assert.ok(released);
});

test("failed transactions roll back; failed rollback preserves the original error and discards the client", async () => {
  const original = Object.assign(new Error("write rejected"), {
    code: "23514",
  });
  await assert.rejects(
    database.withTransaction(() => Promise.reject(original)),
    (error) => error === original,
  );
  assert.deepEqual(calls, ["BEGIN", "ROLLBACK"]);
  calls = [];
  rollbackError = new Error("connection lost during rollback");
  await assert.rejects(
    database.withTransaction(() => Promise.reject(original)),
    (error) => error === original,
  );
  assert.deepEqual(calls, ["BEGIN", "ROLLBACK"]);
  assert.equal(released.error, rollbackError);
});

test("API converts unavailable databases to friendly JSON and hides unexpected SQL errors", async () => {
  const app = express();
  app.get(
    "/data",
    asyncErrorHandler(async (_req, res) =>
      res.json(await database.query("SELECT 1")),
    ),
  );
  app.use(handleError);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    queryError = Object.assign(new Error("private connection details"), {
      code: "ECONNREFUSED",
    });
    let response = await fetch(
      `http://127.0.0.1:${server.address().port}/data`,
    );
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      success: false,
      message:
        "The database is temporarily unavailable. Please try again shortly.",
    });
    queryError = new Error(
      "SELECT password FROM private_table: internal failure",
    );
    response = await fetch(`http://127.0.0.1:${server.address().port}/data`);
    assert.equal(response.status, 500);
    assert.equal(
      (await response.json()).message,
      "Unable to complete this request right now. Please try again.",
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await database.closeDatabase();
  }
});
