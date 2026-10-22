import express from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  sendVerificationEmail,
  verifyOtp,
} from "../controllers/authController.js";
import { isAuthenticated } from "../middleware/authMiddleware.js";
import { validateBody } from "../middleware/validateBody.js";
import { authLimiter, emailLimiter, otpLimiter } from "../utils/rateLimiter.js";

const router = express.Router();

router.post("/register", authLimiter, validateBody("register"), registerUser);
router.post("/login", authLimiter, validateBody("login"), loginUser);
router.post("/logout", isAuthenticated, logoutUser);
router.get("/me", isAuthenticated, getUserProfile);
router.put(
  "/update-me",
  isAuthenticated,
  validateBody("profile"),
  updateProfile,
);
router.put(
  "/me/changePassword",
  isAuthenticated,
  authLimiter,
  validateBody("changePassword"),
  changePassword,
);
router.post(
  "/forgotPassword",
  emailLimiter,
  validateBody("forgotPassword"),
  forgotPassword,
);
router.put(
  "/password/reset/:resetToken",
  authLimiter,
  validateBody("resetPassword"),
  resetPassword,
);
router.post(
  "/sendVerificationEmail",
  isAuthenticated,
  emailLimiter,
  sendVerificationEmail,
);
router.post(
  "/verify",
  isAuthenticated,
  otpLimiter,
  validateBody("otp"),
  verifyOtp,
);

export default router;
