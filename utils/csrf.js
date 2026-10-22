import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config/index.js";

export function csrfTokenFor(token) {
  if (!token || !config.jwt.secret) return null;
  return createHmac("sha256", config.jwt.secret)
    .update(`csrf:${token}`)
    .digest("hex");
}

export function validCsrfToken(candidate, token) {
  const expected = csrfTokenFor(token);
  if (
    typeof candidate !== "string" ||
    !expected ||
    !/^[a-f0-9]{64}$/.test(candidate)
  )
    return false;
  return timingSafeEqual(
    Buffer.from(candidate, "hex"),
    Buffer.from(expected, "hex"),
  );
}
