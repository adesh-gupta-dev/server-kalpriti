import "dotenv/config";

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 3000,
  clientUrl: process.env.CLIENT_URL,
  allowedOrigins: (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  trustProxy: process.env.TRUST_PROXY || "",
  cookie: {
    expiresIn: Number(process.env.COOKIE_EXPIRES_IN) || 7,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
  },
  jwt: {
    secret: process.env.JWT_SECRET_KEY,
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  database: {
    url: process.env.DATABASE_URL,
    poolSize: Number(process.env.DATABASE_POOL_SIZE) || 10,
    statementTimeout:
      Number(process.env.DATABASE_STATEMENT_TIMEOUT_MS) || 15000,
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    service: process.env.SMTP_SERVICE,
    user: process.env.SMTP_MAIL,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM_EMAIL,
  },
  ai: {
    apiKey: process.env.GOOGLE_GEMINI_API_KEY,
    timeout: Number(process.env.AI_TIMEOUT_MS) || 60000,
  },
  rateLimiter: {
    timeForRateLimiter: Number(process.env.RATE_LIMITER_TIME) || 15,
    maxPackages: Number(process.env.MAX_LIMIT_PACKAGE) || 300,
    authMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
    redisUrl: process.env.REDIS_URL,
    instances: Number(process.env.DEPLOYMENT_INSTANCES) || 1,
  },
};
