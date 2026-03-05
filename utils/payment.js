import { stripe } from "../config/stripe.js";
import { Transaction } from "../models/index.js";
import { PLANS } from "../constants/index.js";

export async function createPaymentIntent(planId, totalPrice, userId) {
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) {
    return { success: false, message: "Invalid Plan ID." };
  }

  if (!stripe) {
    console.error("Stripe is not configured");
    return { success: false, message: "Payment service unavailable." };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalPrice * 100),
      currency: "inr",
      metadata: {
        userId: userId.toString(),
        credits: plan.credits.toString(),
        planId,
      },
    });

    await Transaction.create({
      userId,
      planId,
      amount: plan.price,
      credits: plan.credits,
      paymentProvider: "Stripe",
      paymentStatus: "Pending",
      paymentIntentId: paymentIntent.id,
    });

    return { success: true, clientSecret: paymentIntent.client_secret };
  } catch (error) {
    console.error("Payment error:", error.message);
    return { success: false, message: error.message || "Payment failed." };
  }
}
