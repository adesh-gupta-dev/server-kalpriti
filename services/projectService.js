import { WebsiteProject, Conversation, Version } from "../models/index.js";
import { build, update } from "../utils/websiteGeneration.js";

export async function createProject(
  userId,
  { websiteName, initialPrompt },
  next,
) {
  const currentCode = await build(initialPrompt, { _id: userId }, next);
  // console.table(userId, { websiteName, initialPrompt, currentCode });
  if (!currentCode) return null;
  let project;
  try {
    project = await WebsiteProject.create({
      name: websiteName,
      initial_prompt: initialPrompt,
      current_code: currentCode,
      user_Id: userId,
    });
    const [userConversation, aiConversation] = await Promise.all([
      Conversation.create({
        role: "user",
        content: initialPrompt.trim(),
        projectId: project._id,
      }),
      Conversation.create({
        role: "assistant",
        content: currentCode,
        projectId: project._id,
      }),
    ]);

    project.conversation.push(userConversation._id, aiConversation._id);

    const savedVersion = await Version.create({
      code: currentCode,
      description: "Initial version",
      projectId: project._id,
    });

    project.versions.push(savedVersion._id);
    project.current_version_index = "0";
    await project.save();
  } catch (error) {
    console.error("Error creating project:", error);
    return null;
  }
  return project;
}

export async function getUserProjects(userId) {
  return WebsiteProject.find({ user_Id: userId }).sort({ createdAt: -1 });
}

export async function getCommunityProjects() {
  const projects = await WebsiteProject.find({
    isPublished: true,
  })
    .select("name initial_prompt isPublished user_Id createdAt updatedAt")
    .populate("user_Id", "name")
    .sort({ updatedAt: -1 })
    .lean();

  return projects.map((project) => ({
    _id: project._id,
    name: project.name,
    initial_prompt: project.initial_prompt,
    isPublished: Boolean(project.isPublished),
    isInitialPromptVisible: Boolean(project.isPublished),
    user_Id: project.user_Id?._id || project.user_Id,
    ownerName: project.user_Id?.name || "Unknown",
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }));
}

export async function getCommunityProjectById(projectId, userId) {
  const project = await WebsiteProject.findOne({
    _id: projectId,
    isPublished: true,
    user_Id: { $ne: userId },
  })
    .select(
      "name initial_prompt current_code isPublished user_Id createdAt updatedAt",
    )
    .populate("user_Id", "name")
    .lean();

  if (!project) return null;

  return {
    _id: project._id,
    name: project.name,
    initial_prompt: project.initial_prompt,
    current_code: project.current_code,
    isPublished: Boolean(project.isPublished),
    isInitialPromptVisible: Boolean(project.isPublished),
    user_Id: project.user_Id?._id || project.user_Id,
    ownerName: project.user_Id?.name || "Unknown",
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export async function getProjectById(projectId, userId) {
  return WebsiteProject.findOne({ _id: projectId, user_Id: userId });
}

export async function updateProjectVisibility(projectId, userId, isPublished) {
  const project = await WebsiteProject.findOne({
    _id: projectId,
    user_Id: userId,
  });
  if (!project) return null;

  project.isPublished = isPublished;
  await project.save();
  return project;
}

export async function deleteProject(projectId, userId) {
  const result = await WebsiteProject.deleteOne({
    _id: projectId,
    user_Id: userId,
  });
  return result.deletedCount > 0;
}

export async function editProject(
  projectId,
  userId,
  { websiteName, prompt },
  next,
) {
  const project = await WebsiteProject.findOne({
    _id: projectId,
    user_Id: userId,
  });
  if (!project) return null;

  let newCode = project.current_code;
  if (prompt && prompt !== project.initial_prompt) {
    newCode = await update(prompt, project._id, { _id: userId }, next);
  }

  const version = await Version.create({
    code: newCode,
    description: "Version after project edit",
    projectId: project._id,
  });

  project.versions.push(version._id);
  project.current_version_index = String(project.versions.length - 1);
  if (websiteName) project.name = websiteName;
  if (newCode) project.current_code = newCode;
  await project.save();

  return project;
}
