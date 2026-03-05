import { Conversation, WebsiteProject } from "../models/index.js";

export async function getConversations(projectId, userId) {
  const project = await WebsiteProject.findOne({
    _id: projectId,
    user_Id: userId,
  });
  if (!project) return null;

  return Conversation.find({ projectId }).sort({ timestamp: 1 }).lean();
}

export async function addMessage(
  projectId,
  userId,
  { content, role = "user" },
) {
  const project = await WebsiteProject.findOne({
    _id: projectId,
    user_Id: userId,
  });
  if (!project) return null;

  const message = await Conversation.create({
    role,
    content: content.trim(),
    projectId,
  });

  await WebsiteProject.findByIdAndUpdate(projectId, {
    $push: { conversation: message._id },
  });

  return message;
}
