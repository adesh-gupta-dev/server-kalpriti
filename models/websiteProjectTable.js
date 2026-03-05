import mongoose from "mongoose";

const WebsiteProjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    initial_prompt: {
      type: String,
      required: true,
    },

    current_code: {
      type: String,
      default: null,
    },

    current_version_index: {
      type: String,
      default: "",
    },

    user_Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    isPublished: {
      type: Boolean,
      default: false,
    },

    conversation: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation",
      },
    ],

    versions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Version",
      },
    ],
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("WebsiteProject", WebsiteProjectSchema);
