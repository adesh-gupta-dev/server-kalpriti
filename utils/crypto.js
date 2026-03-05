import crypto from "crypto";

/**
 * Generate a secure 6-digit OTP
 */
export function generateOtp() {
  return crypto.randomInt(100000, 1000000);
}

/**
 * Generate a reset password token and its hashed version
 */
export function generateResetPasswordToken() {
  const resetToken = crypto.randomBytes(20).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  const resetPasswordTokenExpire = Date.now() + 15 * 60 * 1000; // 15 minutes

  return {
    resetToken,
    hashedToken,
    resetPasswordTokenExpire,
  };
}

/**
 * Hash a token using SHA-256
 */
export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
