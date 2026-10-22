import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { once } from "node:events";
import { testDatabase } from "./helpers/database.js";
process.env.NODE_ENV = "test";
process.env.STRIPE_SECRET_KEY = "sk_test_webhook_fixture";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_isolated_fixture_only";
const db = await testDatabase();
const { app } = await import("../app.js");
const { stripe } = await import("../config/stripe.js");
const { User, Transaction } = await import("../models/index.js");
let server,
  base,
  user,
  payload,
  closed = false;
before(async () => {
  user = await User.create({
    name: "Webhook fixture",
    email: "webhook@example.test",
    password: "!no-login!",
  });
  await Transaction.create({
    userId: user._id,
    planId: "plan_basic_10",
    amount: 50,
    credits: 20,
    paymentProvider: "Stripe",
    paymentStatus: "Pending",
    paymentIntentId: "pi_webhook_fixture",
  });
  payload = JSON.stringify({
    id: "evt_webhook_fixture",
    object: "event",
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_webhook_fixture",
        status: "succeeded",
        amount_received: 5000,
        currency: "inr",
        metadata: { userId: user._id },
      },
    },
  });
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  if (!closed) await db.engine.close();
});
const signature = (timestamp) =>
  stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
    ...(timestamp ? { timestamp } : {}),
  });
const post = (body, header) =>
  fetch(base + "/payment/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": header },
    body,
  });

test("real Stripe signature verification rejects modified and expired messages", async () => {
  assert.equal((await post(payload + " ", signature())).status, 400);
  assert.equal(
    (await post(payload, signature(Math.floor(Date.now() / 1000) - 600)))
      .status,
    400,
  );
  assert.equal((await User.findById(user._id)).credits, 20);
});
test("signed webhook retries grant credits once through the actual HTTP raw-body route", async () => {
  assert.equal((await post(payload, signature())).status, 200);
  assert.equal((await post(payload, signature())).status, 200);
  assert.equal((await User.findById(user._id)).credits, 40);
});
test("transient webhook storage failures return retryable 503 without leaking internals", async () => {
  await db.engine.close();
  closed = true;
  const response = await post(payload, signature());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    received: false,
    message: "Webhook processing is temporarily unavailable",
  });
});
