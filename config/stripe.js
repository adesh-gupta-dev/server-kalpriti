import Stripe from "stripe";
import { config } from "./index.js";

export const stripe = config.stripe.secretKey
  ? new Stripe(config.stripe.secretKey)
  : null;
