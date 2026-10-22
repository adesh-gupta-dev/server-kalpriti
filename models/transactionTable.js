import * as database from "../config/database.js";
import { newId, transactionRecord } from "../db/records.js";
export default {
  async create(
    {
      userId,
      planId,
      amount,
      credits,
      paymentStatus = "Pending",
      paymentProvider,
      paymentIntentId,
    },
    db = database,
  ) {
    return transactionRecord(
      (
        await db.query(
          "INSERT INTO payment_transactions(id,user_id,plan_id,amount,credits,payment_status,payment_provider,payment_intent_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
          [
            newId(),
            userId,
            planId,
            amount,
            credits,
            paymentStatus,
            paymentProvider,
            paymentIntentId,
          ],
        )
      ).rows[0],
    );
  },
  async findById(id, db = database) {
    return transactionRecord(
      (await db.query("SELECT * FROM payment_transactions WHERE id=$1", [id]))
        .rows[0],
    );
  },
  async findByIntent(paymentIntentId, userId, db = database) {
    return transactionRecord(
      (
        await db.query(
          "SELECT * FROM payment_transactions WHERE payment_intent_id=$1 AND user_id=$2",
          [paymentIntentId, userId],
        )
      ).rows[0],
    );
  },
  async findForUser(userId, db = database) {
    return (
      await db.query(
        "SELECT * FROM payment_transactions WHERE user_id=$1 ORDER BY created_at DESC,id",
        [userId],
      )
    ).rows.map(transactionRecord);
  },
  async findAll(db = database) {
    return (
      await db.query(
        "SELECT * FROM payment_transactions ORDER BY created_at DESC,id",
      )
    ).rows.map(transactionRecord);
  },
  async updateStatus(id, status, db = database) {
    return transactionRecord(
      (
        await db.query(
          "UPDATE payment_transactions SET payment_status=$2,is_paid=($2='Paid'),updated_at=now() WHERE id=$1 RETURNING *",
          [id, status],
        )
      ).rows[0],
    );
  },
};
