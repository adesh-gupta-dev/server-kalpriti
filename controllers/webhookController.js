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
    const invalid =
      err.type === "StripeSignatureVerificationError" ||
      err instanceof SyntaxError ||
      (err.statusCode && err.statusCode < 500);
    console.error("Webhook processing failed", {
      type: err.type || err.code || "UNAVAILABLE",
    });
    res
      .status(invalid ? 400 : 503)
      .json({
        received: false,
        message: invalid
          ? "Invalid webhook request"
          : "Webhook processing is temporarily unavailable",
      });
  }
});
