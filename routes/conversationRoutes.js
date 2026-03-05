import express from "express";
import {
  getConversations,
  addMessage,
} from "../controllers/conversationController.js";
import { isAuthenticated } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/:projectId", isAuthenticated, getConversations);
router.post("/:projectId", isAuthenticated, addMessage);

export default router;
