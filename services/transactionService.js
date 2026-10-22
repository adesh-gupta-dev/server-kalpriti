import { Transaction } from "../models/index.js";
import { stripe } from "../config/stripe.js";
import { createPaymentIntent } from "../utils/payment.js";
import { PLANS } from "../constants/index.js";
import { settlePayment } from "./paymentSettlement.js";
export async function createPaymentTransaction(userId, { planId, totalPrice }) {
  const plan = PLANS.find((plan) => plan.id === planId);
  if (!plan)
    return { success: false, error: "Invalid Plan ID", statusCode: 400 };
  if (Number(totalPrice) !== plan.price)
    return {
      success: false,
      error: "Plan price does not match",
      statusCode: 400,
    };
  const result = await createPaymentIntent(planId, plan.price, userId);
  if (!result.success) return { success: false, error: result.message };
  return {
    success: true,
    price: plan.price,
    clientSecret: result.clientSecret,
  };
}
export const getUserTransactions = (userId) => Transaction.findForUser(userId);
export const getAllTransactions = () => Transaction.findAll();
export const getTransactionById = (id) => Transaction.findById(id);
export const updateTransactionStatus = (id, status) =>
  Transaction.updateStatus(id, status);
export async function confirmPaymentTransaction(userId, paymentIntentId) {
  if (!paymentIntentId)
    return {
      success: false,
      error: "Payment intent ID is required",
      statusCode: 400,
    };
  if (!stripe)
    return {
      success: false,
      error: "Payment service unavailable.",
      statusCode: 503,
    };
  if (!(await Transaction.findByIntent(paymentIntentId, userId)))
    return { success: false, error: "Transaction not found", statusCode: 404 };
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (!intent || intent.status !== "succeeded")
      return {
        success: false,
        error: `Payment is not completed yet (status: ${intent?.status || "unknown"})`,
        statusCode: 409,
      };
    return { success: true, ...(await settlePayment(intent, userId)) };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Unable to verify payment intent",
      statusCode: error.statusCode || 500,
    };
  }
}
