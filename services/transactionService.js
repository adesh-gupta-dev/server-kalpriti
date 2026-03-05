import { Transaction, User } from "../models/index.js";
import { stripe } from "../config/stripe.js";
import { createPaymentIntent } from "../utils/payment.js";
import { PLANS } from "../constants/index.js";

export async function createPaymentTransaction(userId, { planId, totalPrice }) {
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) return { success: false, error: "Invalid Plan ID" };

  const result = await createPaymentIntent(planId, totalPrice, userId);
  if (!result.success) {
    return { success: false, error: result.message };
  }

  return {
    success: true,
    price: totalPrice,
    clientSecret: result.clientSecret,
  };
}

export async function getUserTransactions(userId) {
  return Transaction.find({ userId }).sort({ createdAt: -1 });
}

export async function getAllTransactions() {
  return Transaction.find().sort({ createdAt: -1 });
}

export async function getTransactionById(transactionId) {
  return Transaction.findById(transactionId);
}

export async function updateTransactionStatus(transactionId, paymentStatus) {
  const transaction = await Transaction.findById(transactionId);
  if (!transaction) return null;

  transaction.paymentStatus = paymentStatus;
  if (paymentStatus === "Paid") {
    transaction.isPaid = true;
  }
  await transaction.save();
  return transaction;
}

export async function confirmPaymentTransaction(userId, paymentIntentId) {
  if (!paymentIntentId) {
    return {
      success: false,
      error: "Payment intent ID is required",
      statusCode: 400,
    };
  }

  if (!stripe) {
    return {
      success: false,
      error: "Payment service unavailable.",
      statusCode: 503,
    };
  }

  const transaction = await Transaction.findOne({ paymentIntentId, userId });
  if (!transaction) {
    return {
      success: false,
      error: "Transaction not found",
      statusCode: 404,
    };
  }

  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (!intent || intent.status !== "succeeded") {
      return {
        success: false,
        error: `Payment is not completed yet (status: ${intent?.status || "unknown"})`,
        statusCode: 409,
      };
    }

    const creditsToAdd = Number(intent.metadata?.credits || transaction.credits || 0) || 0;
    const amountPaid =
      Number.isFinite(intent.amount_received) && intent.amount_received > 0
        ? intent.amount_received / 100
        : intent.amount / 100;

    const paidTransaction = await Transaction.findOneAndUpdate(
      { _id: transaction._id, isPaid: false },
      {
        paymentStatus: "Paid",
        isPaid: true,
        amount: amountPaid,
        credits: creditsToAdd,
      },
      { new: true },
    );

    if (paidTransaction) {
      await User.findByIdAndUpdate(userId, {
        $inc: { credits: creditsToAdd },
      });

      return {
        success: true,
        transaction: paidTransaction,
        creditsAdded: creditsToAdd,
        alreadyProcessed: false,
      };
    }

    const latestTransaction = await Transaction.findById(transaction._id);
    return {
      success: true,
      transaction: latestTransaction,
      creditsAdded: 0,
      alreadyProcessed: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Unable to verify payment intent",
      statusCode: 500,
    };
  }
}
