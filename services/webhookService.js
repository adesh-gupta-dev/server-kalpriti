import { stripe } from "../config/stripe.js";
import { Transaction, User } from "../models/index.js";
import { config } from "../config/index.js";

export async function handleStripeWebhook(rawBody, signature) {
  if (!stripe || !config.stripe.webhookSecret) {
    throw new Error("Stripe webhook not configured");
  }

  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    config.stripe.webhookSecret,
  );

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;
    const { userId, credits } = intent.metadata || {};
    const creditsToAdd = Number(credits) || 0;
    const amountPaid =
      Number.isFinite(intent.amount_received) && intent.amount_received > 0
        ? intent.amount_received / 100
        : intent.amount / 100;

    const paidTransaction = await Transaction.findOneAndUpdate(
      { paymentIntentId: intent.id, isPaid: false },
      {
        paymentStatus: "Paid",
        isPaid: true,
        amount: amountPaid,
        credits: creditsToAdd,
      },
      { new: true },
    );

    if (paidTransaction && userId) {
      await User.findByIdAndUpdate(userId, {
        $inc: { credits: creditsToAdd },
      });
    }
  }

  return event.type;
}
