import "dotenv/config";

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 3000,
  clientUrl: process.env.CLIENT_URL,
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
  rateLimiter: {
    timeForRateLimiter: process.env.RATE_LIMITER_TIME,
    maxPackages: process.env.MAX_LIMIT_PACKAGE,
  },
};
