import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { query, withTransaction, closeDatabase } from "../config/database.js";
import { User, Transaction } from "../models/index.js";
import { settlePayment } from "../services/paymentSettlement.js";

let userId;
try {
  const installed = await query(
    "SELECT name FROM schema_migrations ORDER BY name",
  );
  assert.ok(
    installed.rows.some((row) => row.name === "002_session_version.sql"),
    "Run db:migrate first",
  );
  const rollback = new Error("verification rollback");
  await assert.rejects(
    withTransaction(async (db) => {
      await User.create(
        {
          name: "Rollback check",
          email: `rollback-${randomBytes(8).toString("hex")}@example.test`,
          password: "!no-login!",
        },
        db,
      );
      return Promise.reject(rollback);
    }),
    (error) => error === rollback,
  );

  const marker = randomBytes(12).toString("hex");
  const user = await User.create({
    name: "Temporary database verification",
    email: `verify-${marker}@example.test`,
    password: "!no-login!",
  });
  userId = user._id;
  const intentId = `pi_verify_${marker}`;
  await Transaction.create({
    userId,
    planId: "plan_basic_10",
    amount: 50,
    credits: 20,
    paymentProvider: "Stripe",
    paymentStatus: "Pending",
    paymentIntentId: intentId,
  });
  const intent = {
    id: intentId,
    status: "succeeded",
    amount_received: 5000,
    currency: "inr",
    metadata: { userId },
  };
  // No Stripe request is made. Exercise real PostgreSQL row locks using two clients.
  const outcomes = await Promise.all([
    settlePayment(intent, userId),
    settlePayment(intent, userId),
  ]);
  assert.equal(outcomes.filter((result) => !result.alreadyProcessed).length, 1);
  assert.equal((await User.findById(userId)).credits, 40);
  console.log(
    "PostgreSQL verification passed: schema, rollback, and concurrent once-only credit settlement.",
  );
} catch {
  console.error(
    "PostgreSQL verification failed. Check connectivity and apply migrations before retrying.",
  );
  process.exitCode = 1;
} finally {
  if (userId) {
    try {
      await withTransaction(async (db) => {
        await db.query("DELETE FROM payment_transactions WHERE user_id=$1", [
          userId,
        ]);
        await db.query("DELETE FROM users WHERE id=$1", [userId]);
      });
      console.log("Temporary verification records removed.");
    } catch {
      console.error("Unable to remove temporary verification records");
      process.exitCode = 1;
    }
  }
  await closeDatabase();
}
