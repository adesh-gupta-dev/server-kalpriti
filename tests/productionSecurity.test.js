import assert from "node:assert/strict";
import { test, before, after, beforeEach, mock } from "node:test";
import { once } from "node:events";
import { testDatabase } from "./helpers/database.js";
import express from "express";

Object.assign(process.env, {
  NODE_ENV: "production",
  JWT_SECRET_KEY: "isolated-production-security-tests-only-123456",
  CLIENT_URL: "https://app.example.test",
  CORS_ORIGINS: "https://admin.example.test",
  GOOGLE_GEMINI_API_KEY: "test-placeholder",
  STRIPE_SECRET_KEY: "sk_test_placeholder",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  SMTP_HOST: "smtp.example.test",
  SMTP_MAIL: "sender@example.test",
  SMTP_PASSWORD: "test-placeholder",
  SMTP_FROM_EMAIL: "sender@example.test",
  MAX_LIMIT_PACKAGE: "1000",
  AUTH_RATE_LIMIT_MAX: "1000",
  DEPLOYMENT_INSTANCES: "1",
  REDIS_URL: "",
  TRUST_PROXY: "1",
});
const db = await testDatabase();
let sent = [];
mock.module("../utils/email.js", {
  namedExports: {
    sendEmail: async (...args) => {
      sent.push(args);
    },
  },
});
mock.module("../utils/websiteGeneration.js", {
  namedExports: {
    build: async () => "<h1>Ready</h1>",
    update: async () => "<h1>Updated</h1>",
  },
});
const { app } = await import("../app.js");
const { User } = await import("../models/index.js");
const { config } = await import("../config/index.js");
const { configuredClientUrl, isAllowedOrigin, proxySetting } =
  await import("../config/security.js");
const { createLimiter } = await import("../utils/rateLimiter.js");
let server,
  base,
  closed = false;
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  await db.reset();
  sent = [];
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  if (!closed) await db.engine.close();
});

async function request(path, method = "GET", body, headers = {}) {
  const result = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: result.status,
    body: await result.json(),
    headers: result.headers,
  };
}
async function account() {
  const payload = {
    name: "Security User",
    email: "security@example.test",
    password: "SecurePassword123",
  };
  const created = await request("/api/auth/register", "POST", payload);
  assert.equal(created.status, 201);
  await User.update(created.body.user._id, { verified: true });
  const login = await request("/api/auth/login", "POST", {
    email: payload.email,
    password: payload.password,
  });
  assert.equal(login.status, 200);
  return {
    ...payload,
    id: created.body.user._id,
    token: login.body.token,
    csrf: login.body.csrfToken,
    cookie: login.headers.getSetCookie()[0].split(";")[0],
  };
}
const bearer = (token) => ({ authorization: `Bearer ${token}` });

test("production rejects hostile/null/development browser origins before side effects", async () => {
  for (const origin of [
    "null",
    "undefined",
    "https://attacker.example.test",
    "http://localhost:8081",
    "http://192.168.1.2:8081",
    "exp://192.168.1.2:8081",
  ]) {
    const result = await request(
      "/api/auth/forgotPassword",
      "POST",
      { email: "security@example.test" },
      { origin },
    );
    assert.equal(result.status, 403, origin);
    assert.equal(result.headers.get("access-control-allow-credentials"), null);
  }
  assert.equal(sent.length, 0);
  assert.equal(isAllowedOrigin(undefined), true);
  assert.equal(isAllowedOrigin("https://app.example.test"), true);
});

test("reset links always use the configured trusted frontend, including requests without Origin", async () => {
  const user = await account();
  for (const headers of [{ origin: "https://admin.example.test" }, {}]) {
    const result = await request(
      "/api/auth/forgotPassword",
      "POST",
      { email: user.email },
      headers,
    );
    assert.equal(result.status, 200);
    assert.ok(
      sent.at(-1)[2].includes("https://app.example.test/reset-password/"),
    );
    assert.ok(
      !sent.at(-1)[2].includes("https://admin.example.test/reset-password/"),
    );
  }
  const saved = config.clientUrl;
  config.clientUrl = "http://insecure.example.test";
  assert.equal(configuredClientUrl(), null);
  assert.equal(
    (await request("/api/auth/forgotPassword", "POST", { email: user.email }))
      .status,
    503,
  );
  config.clientUrl = saved;
});

test("public endpoints reject invalid types, weak passwords, and excessive bcrypt bytes with 400", async () => {
  for (const password of ["x", "😀".repeat(20), "a".repeat(65)]) {
    assert.equal(
      (
        await request("/api/auth/register", "POST", {
          name: "User",
          email: "bad@example.test",
          password,
        })
      ).status,
      400,
    );
  }
  assert.equal(
    (
      await request("/api/auth/login", "POST", {
        email: {},
        password: "password",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/auth/forgotPassword", "POST", {
        email: ["bad@example.test"],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/auth/register", "POST", {
        name: "User",
        email: "invalid",
        password: "Password123",
      })
    ).status,
    400,
  );
});

test("cookie writes require a session-bound CSRF token; native bearer writes remain supported", async () => {
  const user = await account();
  const path = "/api/auth/update-me";
  assert.equal(
    (await request(path, "PUT", { name: "Changed" }, { cookie: user.cookie }))
      .status,
    403,
  );
  assert.equal(
    (
      await request(
        path,
        "PUT",
        { name: "Changed" },
        { cookie: user.cookie, "x-csrf-token": "a".repeat(64) },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        path,
        "PUT",
        { name: "Changed" },
        {
          cookie: user.cookie,
          "x-csrf-token": user.csrf,
          origin: "https://app.example.test",
        },
      )
    ).status,
    200,
  );
  assert.equal(
    (await request(path, "PUT", { name: "Native Client" }, bearer(user.token)))
      .status,
    200,
  );
  const profile = await request("/api/auth/me", "GET", undefined, {
    cookie: user.cookie,
  });
  assert.equal(profile.body.csrfToken, user.csrf);
  assert.equal(profile.body.user.sessionVersion, undefined);
});

test("password reset revokes old JWTs and issues a usable replacement", async () => {
  const user = await account();
  await request("/api/auth/forgotPassword", "POST", { email: user.email });
  const token = sent.at(-1)[2].match(/reset-password\/([a-f0-9]+)/)[1];
  const reset = await request(`/api/auth/password/reset/${token}`, "PUT", {
    newPassword: "NewPassword123",
    confirmPassword: "NewPassword123",
  });
  assert.equal(reset.status, 200);
  assert.equal(
    (await request("/api/auth/me", "GET", undefined, bearer(user.token)))
      .status,
    401,
  );
  assert.equal(
    (await request("/api/auth/me", "GET", undefined, bearer(reset.body.token)))
      .status,
    200,
  );
});

test("password change and logout revoke prior sessions", async () => {
  const user = await account();
  const changed = await request(
    "/api/auth/me/changePassword",
    "PUT",
    {
      oldPassword: user.password,
      newPassword: "ChangedPassword123",
      confirmPassword: "ChangedPassword123",
    },
    bearer(user.token),
  );
  assert.equal(changed.status, 200);
  assert.equal(
    (await request("/api/auth/me", "GET", undefined, bearer(user.token)))
      .status,
    401,
  );
  assert.equal(
    (
      await request(
        "/api/auth/me",
        "GET",
        undefined,
        bearer(changed.body.token),
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/auth/logout", "POST", {}, bearer(changed.body.token)))
      .status,
    200,
  );
  assert.equal(
    (
      await request(
        "/api/auth/me",
        "GET",
        undefined,
        bearer(changed.body.token),
      )
    ).status,
    401,
  );
});

test("changing email removes verification and existing OTP/reset challenges", async () => {
  const user = await account();
  await User.update(user.id, {
    otpHash: "previous",
    otpExpiresIn: new Date(),
    resetToken: "previous-reset",
    resetTokenExpires: new Date(),
  });
  const changed = await request(
    "/api/auth/update-me",
    "PUT",
    { email: "new@example.test" },
    bearer(user.token),
  );
  assert.equal(changed.status, 200);
  assert.equal(changed.body.updatedUser.verified, false);
  const saved = await User.findById(user.id);
  assert.equal(saved.otpHash, null);
  assert.equal(saved.resetToken, null);
});

test("readiness checks configuration/schema while liveness remains independent", async () => {
  assert.equal((await request("/ready")).status, 200);
  const saved = config.ai.apiKey;
  config.ai.apiKey = "";
  assert.equal((await request("/ready")).status, 503);
  assert.equal((await request("/live")).status, 200);
  const gemini = await import("../utils/geminiResponse.js");
  await assert.rejects(gemini.geminiEnhanceResponse("test"), {
    statusCode: 503,
  });
  config.ai.apiKey = saved;
  const proxy = config.trustProxy;
  config.trustProxy = "true";
  assert.equal(proxySetting(), false);
  config.trustProxy = "not-a-cidr";
  assert.equal(proxySetting(), false);
  config.trustProxy = proxy;
});

test("trusted proxy client addresses receive separate rate budgets and liveness stays unlimited", async () => {
  const limited = express();
  limited.set("trust proxy", 1);
  limited.get("/live", (_req, res) => res.json({ ok: true }));
  limited.use(createLimiter("isolated-test", 2));
  limited.get("/data", (_req, res) => res.json({ ok: true }));
  const listener = limited.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const endpoint = `http://127.0.0.1:${listener.address().port}`;
  try {
    const headers = { "x-forwarded-for": "203.0.113.1" };
    assert.equal((await fetch(endpoint + "/data", { headers })).status, 200);
    assert.equal((await fetch(endpoint + "/data", { headers })).status, 200);
    const blocked = await fetch(endpoint + "/data", { headers });
    assert.equal(blocked.status, 429);
    assert.match((await blocked.json()).message, /Too many requests/);
    assert.equal(
      (
        await fetch(endpoint + "/data", {
          headers: { "x-forwarded-for": "198.51.100.1" },
        })
      ).status,
      200,
    );
    assert.equal((await fetch(endpoint + "/live", { headers })).status, 200);
  } finally {
    await new Promise((resolve) => listener.close(resolve));
  }
});

test("database outages produce readiness 503 without killing liveness", async () => {
  await db.engine.close();
  closed = true;
  const ready = await request("/check");
  assert.equal(ready.status, 503);
  assert.equal(ready.body.checks.database, false);
  assert.equal((await request("/live")).status, 200);
});
