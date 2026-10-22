import { config } from "./index.js";
import { isIP } from "node:net";

function validProxy(value) {
  if (!value || value === "false" || value === "0") return true;
  if (/^[1-9]\d*$/.test(value)) return Number(value) <= 10;
  return value.split(",").every((entry) => {
    const text = entry.trim();
    if (["loopback", "linklocal", "uniquelocal"].includes(text)) return true;
    const [address, prefix, extra] = text.split("/");
    const family = isIP(address);
    return (
      family &&
      !extra &&
      (prefix === undefined ||
        (/^\d+$/.test(prefix) && Number(prefix) <= (family === 4 ? 32 : 128)))
    );
  });
}

function webUrl(value) {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.hash ||
      url.search
    )
      return null;
    if (config.env === "production" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

export function configuredClientUrl() {
  const url = webUrl(config.clientUrl);
  return url ? url.href.replace(/\/$/, "") : null;
}

export function isAllowedOrigin(origin) {
  if (!origin) return true; // Native bearer-token clients and provider webhooks.
  if (origin === "null" || origin === "undefined") return false;
  const allowed = [
    webUrl(config.clientUrl)?.origin,
    ...(config.allowedOrigins || []).map((value) => {
      const parsed = webUrl(value);
      return parsed?.origin === value ? value : null;
    }),
  ].filter(Boolean);
  if (allowed.includes(origin)) return true;
  if (config.env === "production") return false;
  return (
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) ||
    /^exp:\/\//i.test(origin) ||
    /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/i.test(
      origin,
    )
  );
}

export function productionConfigurationIssues() {
  if (config.env !== "production") return [];
  const issues = [];
  if (!configuredClientUrl())
    issues.push("CLIENT_URL must be a trusted HTTPS frontend URL");
  if (!config.jwt.secret || Buffer.byteLength(config.jwt.secret) < 32)
    issues.push("JWT_SECRET_KEY must contain at least 32 bytes");
  if (!/^postgres(?:ql)?:\/\//i.test(config.database.url || ""))
    issues.push("DATABASE_URL must point to PostgreSQL");
  else {
    try {
      const url = new URL(config.database.url);
      if (
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
        url.searchParams.get("sslmode") !== "verify-full"
      )
        issues.push(
          "Hosted DATABASE_URL must use sslmode=verify-full and the provider's trusted certificate",
        );
    } catch {
      issues.push("DATABASE_URL is invalid");
    }
  }
  if (
    (config.allowedOrigins || []).some(
      (origin) => !webUrl(origin) || webUrl(origin).origin !== origin,
    )
  )
    issues.push("CORS_ORIGINS must contain exact HTTPS origins");
  if (!config.ai?.apiKey) issues.push("GOOGLE_GEMINI_API_KEY is required");
  if (!config.stripe.secretKey || !config.stripe.webhookSecret)
    issues.push("Stripe secret key and webhook secret are required");
  if (
    !(config.smtp.host || config.smtp.service) ||
    !config.smtp.user ||
    !config.smtp.password ||
    !config.smtp.from
  )
    issues.push("SMTP configuration is incomplete");
  if (config.rateLimiter.instances > 1 && !config.rateLimiter.redisUrl)
    issues.push("REDIS_URL is required for multiple API instances");
  if (!validProxy(config.trustProxy || ""))
    issues.push(
      "TRUST_PROXY must be explicit trusted hops (1-10), addresses, or CIDRs",
    );
  return issues;
}

export function proxySetting() {
  const value = config.trustProxy?.trim();
  if (!value || value === "0" || value === "false" || !validProxy(value))
    return false;
  if (/^[1-9]\d*$/.test(value)) return Number(value);
  // Explicit named ranges/CIDRs only; never enable unconditional trust.
  return value === "true"
    ? false
    : value.split(",").map((entry) => entry.trim());
}
