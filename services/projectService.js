import ErrorHandler from "../middleware/errorMiddleware.js";
import {
  WebsiteProject,
  Conversation,
  Version,
  User,
} from "../models/index.js";
import { withTransaction } from "../config/database.js";
import { build, update } from "../utils/websiteGeneration.js";
async function debit(db, userId, credits) {
  if (!(await User.consumeCredits(userId, credits, db)))
    throw new ErrorHandler("Insufficient credits", 402);
}
export async function createProject(
  userId,
  { websiteName, initialPrompt },
  next,
) {
  const code = await build(initialPrompt, { _id: userId }, next);
  if (!code) return null;
  return withTransaction(async (db) => {
    await debit(db, userId, 5);
    const project = await WebsiteProject.create(
      {
        name: websiteName,
        initial_prompt: initialPrompt,
        current_code: code,
        user_Id: userId,
      },
      db,
    );
    await Conversation.create(
      { role: "user", content: initialPrompt.trim(), projectId: project._id },
      db,
    );
    await Conversation.create(
      { role: "assistant", content: code, projectId: project._id },
      db,
    );
    const version = await Version.create(
      { code, description: "Initial version", projectId: project._id },
      db,
    );
    return WebsiteProject.update(
      project._id,
      { currentVersionId: version._id },
      db,
    );
  });
}
export const getUserProjects = (userId) => WebsiteProject.findForUser(userId);
export const getCommunityProjects = () => WebsiteProject.community();
export async function getCommunityProjectById(id) {
  return (await WebsiteProject.community(id))[0] || null;
}
export const getProjectById = (id, userId) =>
  WebsiteProject.findOwned(id, userId);
export async function updateProjectVisibility(id, userId, isPublished) {
  return withTransaction(async (db) => {
    if (!(await WebsiteProject.findOwned(id, userId, db, true))) return null;
    return WebsiteProject.update(id, { isPublished }, db);
  });
}
export const deleteProject = (id, userId) =>
  WebsiteProject.deleteOwned(id, userId);
export async function editProject(
  id,
  userId,
  { websiteName, prompt, code },
  next,
) {
  const initial = await WebsiteProject.findOwned(id, userId);
  if (!initial) return null;
  const aiUpdate = !!prompt && prompt !== initial.initial_prompt;
  const newCode = aiUpdate
    ? await update(prompt, id, { _id: userId }, next)
    : (code ?? initial.current_code);
  if (aiUpdate && !newCode) return null;
  return withTransaction(async (db) => {
    const project = await WebsiteProject.findOwned(id, userId, db, true);
    if (!project) return null;
    if (
      aiUpdate &&
      (project.current_code !== initial.current_code ||
        new Date(project.updatedAt).getTime() !==
          new Date(initial.updatedAt).getTime())
    )
      throw new ErrorHandler(
        "Project changed while generating. Please retry.",
        409,
      );
    if (aiUpdate) await debit(db, userId, 3);
    const savedCode =
      aiUpdate || code !== undefined ? newCode : project.current_code;
    const version = await Version.create(
      {
        code: savedCode,
        description: "Version after project edit",
        projectId: id,
      },
      db,
    );
    return WebsiteProject.update(
      id,
      {
        current_code: savedCode,
        currentVersionId: version._id,
        ...(websiteName ? { name: websiteName } : {}),
      },
      db,
    );
  });
}
