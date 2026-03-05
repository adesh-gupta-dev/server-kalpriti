import mongoose from "mongoose";

const VersionSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
  },

  description: {
    type: String,
  },

  timestamp: {
    type: Date,
    default: Date.now,
  },

  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "WebsiteProject",
    required: true,
  },
});

export default mongoose.model("Version", VersionSchema);
