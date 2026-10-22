import crypto from "crypto";


export function generateOtp() {
  return crypto.randomInt(100000, 1000000);
}


export function generateResetPasswordToken() {
  const resetToken = crypto.randomBytes(20).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  const resetPasswordTokenExpire = Date.now() + 15 * 60 * 1000;

  return {
    resetToken,
    hashedToken,
    resetPasswordTokenExpire,
  };
}


export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
