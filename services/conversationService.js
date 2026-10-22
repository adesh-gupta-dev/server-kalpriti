import { Conversation, WebsiteProject } from "../models/index.js";
import { withTransaction } from "../config/database.js";
export async function getConversations(id, userId) {
  if (!(await WebsiteProject.findOwned(id, userId))) return null;
  return Conversation.findForProject(id);
}
export async function addMessage(id, userId, { content, role = "user" }) {
  return withTransaction(async (db) => {
    if (!(await WebsiteProject.findOwned(id, userId, db, true))) return null;
    return Conversation.create(
      { role, content: content.trim(), projectId: id },
      db,
    );
  });
}
