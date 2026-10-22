import assert from "node:assert/strict";
import { test, beforeEach, after } from "node:test";
import { testDatabase } from "./helpers/database.js";
const db = await testDatabase();
const { settlePayment } = await import("../services/paymentSettlement.js");
const { User, Transaction } = await import("../models/index.js");
let user, payment;
const intent = {
  id: "pi_test",
  status: "succeeded",
  amount: 5000,
  amount_received: 5000,
  currency: "inr",
  metadata: {},
};
beforeEach(async () => {
  await db.reset();
  user = await User.create({
    name: "Buyer",
    email: "buyer@example.test",
    password: "hash",
  });
  payment = await Transaction.create({
    userId: user._id,
    planId: "plan_basic_10",
    amount: 50,
    credits: 20,
    paymentProvider: "Stripe",
    paymentIntentId: intent.id,
  });
});
after(() => db.engine.close());
test("webhook and client confirmations grant credits exactly once", async () => {
  const first = await settlePayment(intent, user._id);
  const replay = await settlePayment(intent);
  assert.equal(first.creditsAdded, 20);
  assert.equal(replay.creditsAdded, 0);
  assert.equal(replay.alreadyProcessed, true);
  assert.equal((await User.findById(user._id)).credits, 40);
  assert.equal((await Transaction.findById(payment._id)).paymentStatus, "Paid");
});
test("payment writes and credit grants roll back together on failure", async () => {
  await User.update(user._id, { credits: 2147483640 });
  await assert.rejects(settlePayment(intent));
  assert.equal((await Transaction.findById(payment._id)).isPaid, false);
  assert.equal(
    (
      await db.query(
        "SELECT credits_applied FROM payment_transactions WHERE id=$1",
        [payment._id],
      )
    ).rows[0].credits_applied,
    false,
  );
});
test("payments reject underpayment, currency mismatches, and another user's confirmation", async () => {
  await assert.rejects(
    settlePayment({ ...intent, amount_received: 100 }),
    /does not match/,
  );
  await assert.rejects(
    settlePayment({ ...intent, currency: "usd" }),
    /does not match/,
  );
  await assert.rejects(settlePayment(intent, "other-user"), /not found/);
  assert.equal((await User.findById(user._id)).credits, 20);
});
test("admin status changes cannot cause duplicate credit grants", async () => {
  await Transaction.updateStatus(payment._id, "Paid");
  await settlePayment(intent);
  await Transaction.updateStatus(payment._id, "Pending");
  await settlePayment(intent);
  assert.equal((await User.findById(user._id)).credits, 40);
});
test("pending payment uniqueness and foreign keys are enforced by PostgreSQL", async () => {
  await assert.rejects(
    Transaction.create({
      userId: user._id,
      planId: "other",
      amount: 50,
      credits: 20,
      paymentIntentId: intent.id,
    }),
    (error) => error.code === "23505",
  );
  await assert.rejects(
    Transaction.create({
      userId: "missing-user",
      planId: "other",
      amount: 50,
      credits: 20,
    }),
    (error) => error.code === "23503",
  );
});
