import express from "express";
import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
process.env.REDIS_URL = "redis://127.0.0.1:1";
process.env.NODE_ENV = "test";
const { createLimiter, rateLimitStoreReady, closeRateLimitStore } =
  await import("../utils/rateLimiter.js");
const { handleError } = await import("../middleware/errorMiddleware.js");
test("an unavailable shared limiter fails closed without killing health checks", async () => {
  const app = express();
  app.get("/live", (_req, res) => res.json({ ok: true }));
  app.use(createLimiter("unavailable-test", 2));
  app.get("/data", (_req, res) => res.json({ ok: true }));
  app.use(handleError);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal(await rateLimitStoreReady(), false);
    const response = await fetch(base + "/data");
    assert.equal(response.status, 503);
    assert.equal((await response.json()).success, false);
    assert.equal((await fetch(base + "/live")).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await closeRateLimitStore();
  }
});
