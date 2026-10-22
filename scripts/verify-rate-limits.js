import express from "express";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { config } from "../config/index.js";
import {
  createLimiter,
  closeRateLimitStore,
  rateLimitStoreReady,
} from "../utils/rateLimiter.js";
import { handleError } from "../middleware/errorMiddleware.js";
const servers = [];
try {
  assert.ok(config.rateLimiter.redisUrl, "Set REDIS_URL for this check");
  assert.equal(await rateLimitStoreReady(), true);
  const marker = `verify-${randomBytes(8).toString("hex")}`;
  for (let index = 0; index < 2; index++) {
    const app = express();
    app.use(createLimiter(marker, 2));
    app.get("/data", (_req, res) => res.json({ ok: true }));
    app.use(handleError);
    const server = app.listen(0, "127.0.0.1");
    servers.push(server);
    await once(server, "listening");
  }
  const request = (server) =>
    fetch(`http://127.0.0.1:${server.address().port}/data`);
  assert.equal((await request(servers[0])).status, 200);
  assert.equal((await request(servers[1])).status, 200);
  assert.equal((await request(servers[0])).status, 429);
  console.log(
    "Redis verification passed: both API instances share one rate budget.",
  );
} catch {
  console.error(
    "Shared rate-limit verification failed; configure a reachable REDIS_URL.",
  );
  process.exitCode = 1;
} finally {
  await Promise.all(
    servers.map((server) => new Promise((resolve) => server.close(resolve))),
  );
  await closeRateLimitStore();
}
