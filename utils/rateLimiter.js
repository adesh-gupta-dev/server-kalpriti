import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { createClient } from "redis";
import { RedisStore } from "rate-limit-redis";
import { config } from "../config/index.js";
import ErrorHandler from "../middleware/errorMiddleware.js";

let redis;
let connecting;
async function redisClient() {
  if (!redis) {
    redis = createClient({
      url: config.rateLimiter.redisUrl,
      disableOfflineQueue: true,
      socket: { connectTimeout: 3000, reconnectStrategy: false },
    });
    redis.on("error", () => console.error("Rate-limit store unavailable"));
  }
  if (!redis.isReady) {
    if (!connecting)
      connecting = redis.connect().finally(() => {
        connecting = null;
      });
    await connecting;
  }
  return redis;
}

class LazyRedisStore {
  constructor(name) {
    this.name = name;
  }
  init(options) {
    this.options = options;
  }
  async ready() {
    if (!this.loading)
      this.loading = (async () => {
        const client = await redisClient();
        const store = new RedisStore({
          prefix: `kalpriti:${this.name}:`,
          sendCommand: (...args) => client.sendCommand(args),
        });
        await store.init(this.options);
        return store;
      })().catch(() => {
        this.loading = null;
        return Promise.reject(
          new ErrorHandler(
            "Request protection is temporarily unavailable. Please try again shortly.",
            503,
          ),
        );
      });
    return this.loading;
  }
  async increment(key) {
    try {
      return await (await this.ready()).increment(key);
    } catch {
      this.loading = null;
      return Promise.reject(
        new ErrorHandler(
          "Request protection is temporarily unavailable. Please try again shortly.",
          503,
        ),
      );
    }
  }
  async decrement(key) {
    return (await this.ready()).decrement(key);
  }
  async resetKey(key) {
    return (await this.ready()).resetKey(key);
  }
}

export function createLimiter(name, max) {
  return rateLimit({
    windowMs: config.rateLimiter.timeForRateLimiter * 60 * 1000,
    limit: max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (request) =>
      `${request.user?._id || "anonymous"}:${ipKeyGenerator(request.ip)}`,
    handler: (_request, response) =>
      response.status(429).json({
        success: false,
        message: "Too many requests. Please wait and try again.",
      }),
    ...(config.rateLimiter.redisUrl ? { store: new LazyRedisStore(name) } : {}),
  });
}

export const authLimiter = createLimiter("auth", config.rateLimiter.authMax);
export const emailLimiter = createLimiter("email", config.rateLimiter.authMax);
export const otpLimiter = createLimiter("otp", config.rateLimiter.authMax);
export default createLimiter("api", config.rateLimiter.maxPackages);

export async function rateLimitStoreReady() {
  if (!config.rateLimiter.redisUrl) return config.rateLimiter.instances <= 1;
  try {
    return (await (await redisClient()).ping()) === "PONG";
  } catch {
    return false;
  }
}
export async function closeRateLimitStore() {
  if (redis?.isOpen) redis.destroy();
  redis = undefined;
}
