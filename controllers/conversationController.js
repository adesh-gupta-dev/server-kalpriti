import { asyncErrorHandler } from "../middleware/asyncErrorHandler.js";
import ErrorHandler from "../middleware/errorMiddleware.js";
import * as conversationService from "../services/conversationService.js";
import { CONVERSATION_ROLES } from "../constants/index.js";

export const getConversations = asyncErrorHandler(async (req, res, next) => {
  const { projectId } = req.params;
  const userId = req.user?._id;

  if (!userId) {
    return next(new ErrorHandler("Please login to access this resource", 401));
  }
  if (!projectId) {
    return next(new ErrorHandler("Project ID is required", 400));
  }

  const conversations = await conversationService.getConversations(
    projectId,
    userId,
  );

  if (!conversations) {
    return next(new ErrorHandler("Project not found or access denied", 404));
  }

  res.status(200).json({ success: true, conversations });
});

export const addMessage = asyncErrorHandler(async (req, res, next) => {
  const { projectId } = req.params;
  const { content, role = "user" } = req.body;
  const userId = req.user?._id;

  if (!userId) {
    return next(new ErrorHandler("Please login to access this resource", 401));
  }
  if (!projectId || !content?.trim()) {
    return next(new ErrorHandler("Project ID and content are required", 400));
  }
  if (!CONVERSATION_ROLES.includes(role)) {
    return next(new ErrorHandler("Invalid role", 400));
  }

  const message = await conversationService.addMessage(projectId, userId, {
    content,
    role,
  });

  if (!message) {
    return next(new ErrorHandler("Project not found or access denied", 404));
  }

  res.status(201).json({
    success: true,
    message: "Message added",
    conversation: message,
  });
});
