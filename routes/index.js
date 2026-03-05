import express from "express";
import authRoutes from "./authRoutes.js";
import projectRoutes from "./projectRoutes.js";
import conversationRoutes from "./conversationRoutes.js";
import versionRoutes from "./versionRoutes.js";
import paymentRoutes from "./paymentRoutes.js";

const router = express.Router();

// API routes - consistent /api prefix
router.use("/auth", authRoutes);
router.use("/projects", projectRoutes);
router.use("/conversations", conversationRoutes);
router.use("/versions", versionRoutes);
router.use("/payment", paymentRoutes);

export default router;
