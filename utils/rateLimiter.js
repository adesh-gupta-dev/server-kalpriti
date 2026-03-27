import rateLimit from "express-rate-limit";
import { config } from "./../config/index.js";
const limiter = rateLimit({
  windowMs: config.rateLimiter.timeForRateLimiter * 60 * 1000, // 15 minutes
  max: config.rateLimiter.maxPackages, // limit each IP to 100 requests per window
  message: "Too many requests from this IP, please try again later.",
});
export default limiter;
