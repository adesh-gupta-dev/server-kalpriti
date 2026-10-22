import assert from "node:assert/strict";
import { test, mock, before, after } from "node:test";
import { once } from "node:events";
import { testDatabase } from "./helpers/database.js";
const db = await testDatabase();
process.env.JWT_SECRET_KEY = "postgres-http-integration-only";
process.env.RATE_LIMITER_TIME = "15";
process.env.MAX_LIMIT_PACKAGE = "1000";
mock.module("../utils/email.js", {
  namedExports: { sendEmail: async () => {} },
});
mock.module("../utils/websiteGeneration.js", {
  namedExports: {
    build: async () => "<h1>Generated</h1>",
    update: async () => "<h1>Updated</h1>",
  },
});
let lastIntent;
mock.module("../config/stripe.js", {
  namedExports: {
    stripe: {
      paymentIntents: {
        create: async (options) => {
          lastIntent = {
            id: "pi_http",
            status: "succeeded",
            ...options,
            amount_received: options.amount,
          };
          return { ...lastIntent, client_secret: "test-client-secret" };
        },
        retrieve: async () => lastIntent,
      },
      webhooks: {
        constructEvent: () => ({
          type: "payment_intent.succeeded",
          data: { object: lastIntent },
        }),
      },
    },
  },
});
const { app } = await import("../app.js");
const { User } = await import("../models/index.js");
let server, base;
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.engine.close();
});
async function request(path, method = "GET", data, token) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  return { status: response.status, body: await response.json() };
}
test("preserves the application's HTTP contracts against PostgreSQL", async () => {
  let response = await request("/api/auth/register", "POST", {
    name: "Owner",
    email: "owner@example.test",
    password: "TestPassword123",
  });
  assert.equal(response.status, 201);
  const userId = response.body.user._id;
  assert.equal(response.body.user.password, undefined);
  response = await request("/api/auth/login", "POST", {
    email: "owner@example.test",
    password: "TestPassword123",
  });
  const token = response.body.token;
  assert.ok(token);
  assert.equal(response.body.user.password, undefined);
  assert.equal(
    (
      await request(
        "/project/create",
        "POST",
        { websiteName: "Site", initialPrompt: "Create a website" },
        token,
      )
    ).status,
    403,
  );
  await User.update(userId, { verified: true });
  response = await request(
    "/project/create",
    "POST",
    { websiteName: "Site", initialPrompt: "Create a website" },
    token,
  );
  assert.equal(response.status, 201);
  const project = response.body.WebsiteProject;
  assert.match(project._id, /^[a-f0-9]{24}$/);
  assert.equal(project.current_version_index, "0");
  const code = '<html><script>const preserved = "yes";</script></html>';
  response = await request(
    `/project/edit/${project._id}`,
    "PUT",
    { code },
    token,
  );
  assert.equal(response.body.project.current_code, code);
  response = await request(`/version/${project._id}/all`, "GET", null, token);
  assert.equal(response.body.versions.length, 2);
  assert.equal(response.body.currentVersionIndex, "1");
  response = await request(
    `/conversation/${project._id}`,
    "POST",
    { content: "Hello", role: "user" },
    token,
  );
  assert.equal(response.status, 201);
  response = await request(`/conversation/${project._id}`, "GET", null, token);
  assert.equal(response.body.conversations.length, 3);
  await request(
    `/project/visibility/${project._id}`,
    "PUT",
    { isPublished: true },
    token,
  );
  response = await request("/project/community", "GET", null, token);
  assert.equal(response.body.projects[0].ownerName, "Owner");
  response = await request(
    "/payment/create",
    "POST",
    { planId: "plan_basic_10", totalPrice: 50 },
    token,
  );
  assert.equal(response.body.clientSecret, "test-client-secret");
  response = await request(
    "/payment/confirm",
    "POST",
    { paymentIntentId: "pi_http" },
    token,
  );
  assert.equal(response.body.creditsAdded, 20);
  response = await request(
    "/payment/confirm",
    "POST",
    { paymentIntentId: "pi_http" },
    token,
  );
  assert.equal(response.body.alreadyProcessed, true);
  response = await request("/api/auth/me", "GET", null, token);
  assert.equal(response.body.user.credits, 35);
  assert.equal(response.body.user.password, undefined);
  assert.equal(
    (await request("/payment/admin/transactions", "GET", null, token)).status,
    403,
  );
  await User.update(userId, { role: "ADMIN" });
  response = await request("/payment/admin/transactions", "GET", null, token);
  assert.equal(response.body.transactions.length, 1);
  await request(`/project/${project._id}`, "DELETE", null, token);
  assert.equal(
    (await request(`/project/${project._id}`, "GET", null, token)).status,
    404,
  );
});
