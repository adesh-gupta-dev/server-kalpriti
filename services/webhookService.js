import { stripe } from "../config/stripe.js";
import { config } from "../config/index.js";
import { settlePayment } from "./paymentSettlement.js";
export async function handleStripeWebhook(rawBody, signature) {
  if (!stripe || !config.stripe.webhookSecret)
    throw new Error("Stripe webhook not configured");
  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    config.stripe.webhookSecret,
  );
  if (event.type === "payment_intent.succeeded") {
    // An unknown intent can belong to another product on the same Stripe account.
    try {
      await settlePayment(event.data.object);
    } catch (error) {
      if (error.statusCode !== 404) throw error;
    }
  }
  return event.type;
}
