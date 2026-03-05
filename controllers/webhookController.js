import { asyncErrorHandler } from "../middleware/asyncErrorHandler.js";
import * as webhookService from "../services/webhookService.js";

export const handleStripeWebhook = asyncErrorHandler(async (req, res) => {
  const signature = req.headers["stripe-signature"];

  try {
    const eventType = await webhookService.handleStripeWebhook(
      req.body,
      signature,
    );
    res.json({ received: true, eventType });
  } catch (err) {
    console.error("Webhook error:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});
