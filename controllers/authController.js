import { asyncErrorHandler } from "../middleware/asyncErrorHandler.js";
import ErrorHandler from "../middleware/errorMiddleware.js";
import { config } from "../config/index.js";
import * as authService from "../services/authService.js";
import { checkIsVerified } from "../utils/cheackIsVerified.js";

export const registerUser = asyncErrorHandler(async (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name?.trim() || !email?.trim() || !password) {
    return next(new ErrorHandler("Please provide all required fields", 400));
  }

  const result = await authService.register({ name, email, password });
  if (!result.success) {
    return next(new ErrorHandler(result.error, 400));
  }

  res.status(201).json({
    success: true,
    message: "User registered successfully",
    user: result.user,
  });
});

export const loginUser = asyncErrorHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password) {
    return next(new ErrorHandler("Please provide email and password", 400));
  }

  const result = await authService.login({ email, password });
  if (!result.success) {
    return next(new ErrorHandler(result.error, 401));
  }

  authService.sendAuthToken(result.user, 200, "Login successful", res);
});

export const logoutUser = asyncErrorHandler(async (req, res) => {
  res.cookie("token", null, {
    expires: new Date(Date.now()),
    httpOnly: true,
    sameSite: config.cookie.sameSite,
    secure: config.cookie.secure,
    path: "/",
  });
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

export const getUserProfile = asyncErrorHandler(async (req, res, next) => {
  const user = await authService.getUserById(req.user._id);
  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }
  res.status(200).json({ success: true, user });
});

export const updateProfile = asyncErrorHandler(async (req, res, next) => {
  const { name, email } = req.body;

  if (!name && !email) {
    return next(new ErrorHandler("Nothing to update", 400));
  }

  const updatedUser = await authService.updateUserProfile(req.user._id, {
    ...(name && { name }),
    ...(email && { email }),
  });

  res.status(200).json({
    message: "User updated successfully",
    updatedUser,
  });
});

export const changePassword = asyncErrorHandler(async (req, res, next) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (!(await checkIsVerified(req.user._id)).verified) {
    return next(
      new ErrorHandler("Please verify your email to access this feature", 403),
    );
  }

  if (!oldPassword || !newPassword || !confirmPassword) {
    return next(new ErrorHandler("Please provide all required fields", 400));
  }
  if (newPassword !== confirmPassword) {
    return next(
      new ErrorHandler("New password and confirm password do not match", 400),
    );
  }

  const result = await authService.changeUserPassword(
    req.user._id,
    oldPassword,
    newPassword,
  );
  if (!result.success) {
    return next(new ErrorHandler(result.error, 401));
  }

  authService.sendAuthToken(
    result.user,
    200,
    "Password updated successfully",
    res,
  );
});

export const forgotPassword = asyncErrorHandler(async (req, res, next) => {
  const { email } = req.body;

  if (!email?.trim()) {
    return next(new ErrorHandler("Please provide email", 400));
  }

  const frontendBaseUrl =
    req.get("origin") || config.clientUrl || `${req.protocol}://${req.get("host")}`;
  const result = await authService.initiatePasswordReset(email, frontendBaseUrl);

  if (!result.success) {
    return next(new ErrorHandler(result.error, 400));
  }

  res.status(200).json({
    success: true,
    message: "Password reset link sent to your email",
  });
});

export const resetPassword = asyncErrorHandler(async (req, res, next) => {
  const { resetToken } = req.params;
  const { newPassword, confirmPassword } = req.body;

  if (!resetToken) {
    return next(new ErrorHandler("Reset token is required", 400));
  }
  if (!newPassword || !confirmPassword) {
    return next(new ErrorHandler("Please provide all required fields", 400));
  }
  if (newPassword !== confirmPassword) {
    return next(
      new ErrorHandler("New password and confirm password do not match", 400),
    );
  }

  const result = await authService.resetPasswordWithToken(
    resetToken,
    newPassword,
  );
  if (!result.success) {
    return next(new ErrorHandler(result.error, 400));
  }

  authService.sendAuthToken(result.user, 200, "Password reset successful", res);
});

export const sendVerificationEmail = asyncErrorHandler(
  async (req, res, next) => {
    const result = await authService.sendVerificationOtp(req.user._id);
    if (!result.success) {
      return next(new ErrorHandler(result.error, 404));
    }

    res.status(200).json({
      success: true,
      message: "Verification OTP sent to your email",
    });
  },
);

export const verifyOtp = asyncErrorHandler(async (req, res, next) => {
  const { otp } = req.body;

  if (!otp) {
    return next(new ErrorHandler("Please provide OTP", 400));
  }

  const result = await authService.verifyOtpAndConfirm(req.user._id, otp);
  if (!result.success) {
    return next(new ErrorHandler(result.error, 400));
  }

  res.status(200).json({
    success: true,
    message: "Email verified successfully",
  });
});
