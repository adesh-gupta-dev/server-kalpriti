import ErrorHandler from "../middleware/errorMiddleware.js";
import { withTransaction } from "../config/database.js";
import { transactionRecord } from "../db/records.js";
export async function settlePayment(intent, expectedUserId) {
  return withTransaction(async (db) => {
    const row = (
      await db.query(
        "SELECT * FROM payment_transactions WHERE payment_intent_id=$1 FOR UPDATE",
        [intent.id],
      )
    ).rows[0];
    if (!row || (expectedUserId && row.user_id !== String(expectedUserId)))
      throw new ErrorHandler("Transaction not found", 404);
    if (
      intent.metadata?.userId &&
      String(intent.metadata.userId) !== row.user_id
    )
      throw new ErrorHandler("Payment ownership mismatch", 409);
    const cents =
      Number.isFinite(intent.amount_received) && intent.amount_received > 0
        ? intent.amount_received
        : intent.amount;
    if (
      intent.status !== "succeeded" ||
      !Number.isInteger(cents) ||
      cents < Math.round(Number(row.amount) * 100) ||
      (intent.currency && intent.currency.toLowerCase() !== "inr")
    )
      throw new ErrorHandler(
        "Payment amount, currency, or status does not match the transaction",
        409,
      );
    if (row.credits_applied)
      return {
        transaction: transactionRecord(row),
        creditsAdded: 0,
        alreadyProcessed: true,
      };
    const updated = (
      await db.query(
        "UPDATE payment_transactions SET is_paid=true,credits_applied=true,payment_status='Paid',amount=$2,updated_at=now() WHERE id=$1 RETURNING *",
        [row.id, cents / 100],
      )
    ).rows[0];
    const user = await db.query(
      "UPDATE users SET credits=credits+$2,updated_at=now() WHERE id=$1 RETURNING id",
      [row.user_id, row.credits],
    );
    if (!user.rows.length) throw new Error("Payment user not found");
    return {
      transaction: transactionRecord(updated),
      creditsAdded: row.credits,
      alreadyProcessed: false,
    };
  });
}
