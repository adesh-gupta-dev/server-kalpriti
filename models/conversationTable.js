import mongoose from "mongoose";
import { CONVERSATION_ROLES } from "../constants/index.js";

const conversationSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: CONVERSATION_ROLES,
    required: true,
  },

  content: { type: String, required: true },

  timestamp: { type: Date, default: Date.now },

  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "WebsiteProject",
    required: true,
  },
});

export default mongoose.model("Conversation", conversationSchema);
