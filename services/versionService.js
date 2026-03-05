import { Version, WebsiteProject } from "../models/index.js";

export async function saveVersion(projectId, userId, description) {
  const project = await WebsiteProject.findOne({
    _id: projectId,
    user_Id: userId,
  });
  if (!project) return null;

  const version = await Version.create({
    code: project.current_code,
    description: description || `Version ${project.versions.length + 1}`,
    projectId: project._id,
  });

  project.versions.push(version._id);
  project.current_version_index = String(project.versions.length - 1);
  await project.save();

  return version;
}

export async function getVersions(projectId, userId) {
  const project = await WebsiteProject.findOne({
    _id: projectId,
    user_Id: userId,
  }).populate("versions");
  if (!project) return null;

  return {
    versions: project.versions,
    currentVersionIndex: project.current_version_index,
  };
}

export async function getVersionById(projectId, versionId, userId) {
  const project = await WebsiteProject.findOne({
    _id: projectId,
    user_Id: userId,
  });
  if (!project) return null;

  return Version.findOne({ _id: versionId, projectId });
}

export async function restoreVersion(projectId, versionId, userId) {
  const project = await WebsiteProject.findOne({
    _id: projectId,
    user_Id: userId,
  });
  if (!project) return null;

  const version = await Version.findOne({ _id: versionId, projectId });
  if (!version) return null;

  project.current_code = version.code;
  const versionIndex = project.versions.findIndex(
    (v) => v.toString() === versionId,
  );
  project.current_version_index = String(versionIndex);
  await project.save();

  return project;
}

export async function deleteVersion(projectId, versionId, userId) {
  const project = await WebsiteProject.findOne({
    _id: projectId,
    user_Id: userId,
  });
  if (!project) return null;

  await Version.deleteOne({ _id: versionId, projectId });
  project.versions = project.versions.filter((v) => v.toString() !== versionId);
  await project.save();

  return true;
}
