import bcrypt from "bcryptjs";
import { User } from "../models/index.js";
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
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

export async function register({ name, email, password }) {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return { success: false, error: "User already exists" };
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ name, email, password: hashedPassword });
  return { success: true, user };
}

export async function login({ email, password }) {
  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    return { success: false, error: "Invalid email or password" };
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return { success: false, error: "Invalid email or password" };
  }

  return { success: true, user };
}

export function sendAuthToken(user, statusCode, message, res) {
  return sendToken(user, statusCode, message, res);
}

export async function getUserById(userId) {
  return User.findById(userId);
}

export async function updateUserProfile(userId, updates) {
  return User.findByIdAndUpdate(
    userId,
    { ...updates },
    { new: true, runValidators: true },
  ).select("-password");
}

export async function changeUserPassword(userId, oldPassword, newPassword) {
  const user = await User.findById(userId).select("+password");
  if (!user) return { success: false, error: "User not found" };

  const isValid = await bcrypt.compare(oldPassword, user.password);
  if (!isValid) return { success: false, error: "Invalid old password" };

  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { password: hashedPassword },
    { new: true },
  );

  return { success: true, user: updatedUser };
}

export async function initiatePasswordReset(email, resetLinkBase) {
  const user = await User.findOne({ email }).select("-password");
  if (!user) return { success: false, error: "User not found" };

  const { resetToken, hashedToken, resetPasswordTokenExpire } =
    generateResetPasswordToken();
  user.resetToken = hashedToken;
  user.resetTokenExpires = resetPasswordTokenExpire;
  await user.save({ validateBeforeSave: false });

  const resetLink = `${resetLinkBase}/reset-password/${resetToken}`;
  await sendEmail(
    user.email,
    "Password Reset Request",
    forgotPasswordEmailTemplate(resetLink),
  );

  return { success: true };
}

export async function resetPasswordWithToken(resetToken, newPassword) {
  const hashedToken = hashToken(resetToken);
  const user = await User.findOne({ resetToken: hashedToken });
  if (!user) return { success: false, error: "Invalid or expired reset token" };
  if (user.resetTokenExpires < Date.now())
    return { success: false, error: "Reset token has expired" };

  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
  user.password = hashedPassword;
  user.resetToken = null;
  user.resetTokenExpires = null;
  await user.save();

  return { success: true, user };
}

export async function sendVerificationOtp(userId) {
  const user = await User.findById(userId);
  if (!user) return { success: false, error: "User not found" };

  const otp = generateOtp().toString();
  const hashedOtp = await bcrypt.hash(otp, SALT_ROUNDS);
  user.otpHash = hashedOtp;
  user.otpExpiresIn = Date.now() + OTP_EXPIRY_MS;
  await user.save({ validateBeforeSave: false });

  await sendEmail(
    user.email,
    "Email Verification - AI Builder",
    verificationEmailTemplate(user.name, otp),
  );

  return { success: true };
}

export async function verifyOtpAndConfirm(userId, otp) {
  const user = await User.findById(userId);
  if (!user) return { success: false, error: "User not found" };
  if (user.otpExpiresIn < Date.now())
    return { success: false, error: "OTP has expired" };

  const isOtpValid = await bcrypt.compare(otp, user.otpHash);
  if (!isOtpValid) return { success: false, error: "Invalid OTP" };

  user.verified = true;
  user.otpHash = null;
  user.otpExpiresIn = null;
  await user.save({ validateBeforeSave: false });

  return { success: true };
}
