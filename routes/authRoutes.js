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

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", isAuthenticated, logoutUser);
router.get("/me", isAuthenticated, getUserProfile);
router.put("/update-me", isAuthenticated, updateProfile);
router.put("/me/changePassword", isAuthenticated, changePassword);
router.post("/forgotPassword", forgotPassword);
router.put("/password/reset/:resetToken", resetPassword);
router.post("/sendVerificationEmail", isAuthenticated, sendVerificationEmail);
router.post("/verify", isAuthenticated, verifyOtp);

export default router;
