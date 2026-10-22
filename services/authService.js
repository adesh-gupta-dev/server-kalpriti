import bcrypt from "bcryptjs";
import { User } from "../models/index.js";
import { publicUser } from "../db/records.js";
import { configuredClientUrl } from "../config/security.js";
import { query, withTransaction } from "../config/database.js";
import { sendToken } from "../utils/jwt.js";
import { sendEmail } from "../utils/email.js";
import {
  generateOtp,
  generateResetPasswordToken,
  hashToken,
} from "../utils/crypto.js";
import { forgotPasswordEmailTemplate } from "../utils/templates/forgotPassword.js";
import { verificationEmailTemplate } from "../utils/templates/verification.js";
const SALT_ROUNDS = 10;
const OTP_EXPIRY_MS = 10 * 60 * 1000;
export async function register({ name, email, password }) {
  if (await User.findByEmail(email))
    return { success: false, error: "User already exists" };
  try {
    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, SALT_ROUNDS),
    });
    return { success: true, user: publicUser(user) };
  } catch (error) {
    if (error.code === "23505")
      return { success: false, error: "User already exists" };
    return Promise.reject(error);
  }
}
export async function login({ email, password }) {
  const user = await User.findByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password)))
    return { success: false, error: "Invalid email or password" };
  return {
    success: true,
    user: publicUser(user),
    sessionVersion: user.sessionVersion,
  };
}
export function sendAuthToken(
  user,
  statusCode,
  message,
  res,
  sessionVersion = 0,
) {
  return sendToken(publicUser(user), statusCode, message, res, sessionVersion);
}
export async function getUserById(id) {
  return publicUser(await User.findById(id));
}
export async function updateUserProfile(id, updates) {
  return withTransaction(async (db) => {
    const current = await User.findById(id, db, true);
    if (!current) return null;
    const changedEmail =
      typeof updates.email === "string" &&
      updates.email.trim().toLowerCase() !== current.email;
    return publicUser(
      await User.update(
        id,
        {
          ...(updates.name !== undefined ? { name: updates.name } : {}),
          ...(updates.email !== undefined ? { email: updates.email } : {}),
          ...(changedEmail
            ? {
                verified: false,
                otpHash: null,
                otpExpiresIn: null,
                resetToken: null,
                resetTokenExpires: null,
              }
            : {}),
        },
        db,
      ),
    );
  });
}
export async function changeUserPassword(id, oldPassword, newPassword) {
  const user = await User.findById(id);
  if (!user) return { success: false, error: "User not found" };
  if (!(await bcrypt.compare(oldPassword, user.password)))
    return { success: false, error: "Invalid old password" };
  const updated = await User.changePassword(
    id,
    user.password,
    await bcrypt.hash(newPassword, SALT_ROUNDS),
  );
  return updated
    ? {
        success: true,
        user: publicUser(updated),
        sessionVersion: updated.sessionVersion,
      }
    : { success: false, error: "Password changed. Please sign in again." };
}
export async function initiatePasswordReset(email) {
  const resetLinkBase = configuredClientUrl();
  if (!resetLinkBase)
    return {
      success: false,
      statusCode: 503,
      error:
        "Password recovery is temporarily unavailable. Please try again later.",
    };
  const user = await User.findByEmail(email);
  if (!user) return { success: false, error: "User not found" };
  const { resetToken, hashedToken, resetPasswordTokenExpire } =
    generateResetPasswordToken();
  await User.update(user._id, {
    resetToken: hashedToken,
    resetTokenExpires: new Date(resetPasswordTokenExpire),
  });
  await sendEmail(
    user.email,
    "Password Reset Request",
    forgotPasswordEmailTemplate(
      `${resetLinkBase}/reset-password/${resetToken}`,
    ),
  );
  return { success: true };
}
export async function resetPasswordWithToken(token, password) {
  const hashedToken = hashToken(token);
  const result = await query(
    "UPDATE users SET password=$2,session_version=session_version+1,reset_token=NULL,reset_token_expires=NULL,updated_at=now() WHERE reset_token=$1 AND reset_token_expires>now() RETURNING id,session_version",
    [hashedToken, await bcrypt.hash(password, SALT_ROUNDS)],
  );
  if (!result.rows.length)
    return { success: false, error: "Invalid or expired reset token" };
  return {
    success: true,
    user: await getUserById(result.rows[0].id),
    sessionVersion: result.rows[0].session_version,
  };
}
export const revokeSessions = (id) => User.revokeSessions(id);
export async function sendVerificationOtp(id) {
  const user = await User.findById(id);
  if (!user) return { success: false, error: "User not found" };
  const otp = generateOtp().toString();
  await User.update(id, {
    otpHash: await bcrypt.hash(otp, SALT_ROUNDS),
    otpExpiresIn: new Date(Date.now() + OTP_EXPIRY_MS),
  });
  await sendEmail(
    user.email,
    "Email Verification - AI Builder",
    verificationEmailTemplate(user.name, otp),
  );
  return { success: true };
}
export async function verifyOtpAndConfirm(id, otp) {
  const user = await User.findById(id);
  if (!user) return { success: false, error: "User not found" };
  if (
    !user.otpHash ||
    !user.otpExpiresIn ||
    new Date(user.otpExpiresIn).getTime() <= Date.now()
  )
    return { success: false, error: "OTP has expired" };
  if (!(await bcrypt.compare(String(otp), user.otpHash)))
    return { success: false, error: "Invalid OTP" };
  const result = await query(
    "UPDATE users SET verified=true,otp_hash=NULL,otp_expires_in=NULL,updated_at=now() WHERE id=$1 AND otp_hash=$2 AND otp_expires_in>now() RETURNING id",
    [id, user.otpHash],
  );
  return result.rows.length
    ? { success: true }
    : { success: false, error: "OTP has expired" };
}
