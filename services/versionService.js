import { Version, WebsiteProject } from "../models/index.js";
import { withTransaction } from "../config/database.js";
export async function saveVersion(id, userId, description) {
  return withTransaction(async (db) => {
    const project = await WebsiteProject.findOwned(id, userId, db, true);
    if (!project) return null;
    const version = await Version.create(
      {
        code: project.current_code,
        description: description || `Version ${project.versions.length + 1}`,
        projectId: id,
      },
      db,
    );
    await WebsiteProject.update(id, { currentVersionId: version._id }, db);
    return version;
  });
}
export async function getVersions(id, userId) {
  return withTransaction(async (db) => {
    const project = await WebsiteProject.findOwned(id, userId, db, true);
    if (!project) return null;
    return {
      versions: await Version.findForProject(id, db),
      currentVersionIndex: project.current_version_index,
    };
  });
}
export async function getVersionById(id, versionId, userId) {
  if (!(await WebsiteProject.findOwned(id, userId))) return null;
  return Version.findById(versionId, id);
}
export async function restoreVersion(id, versionId, userId) {
  return withTransaction(async (db) => {
    if (!(await WebsiteProject.findOwned(id, userId, db, true))) return null;
    const version = await Version.findById(versionId, id, db);
    if (!version) return null;
    return WebsiteProject.update(
      id,
      { current_code: version.code, currentVersionId: versionId },
      db,
    );
  });
}
export async function deleteVersion(id, versionId, userId) {
  return withTransaction(async (db) => {
    if (!(await WebsiteProject.findOwned(id, userId, db, true))) return null;
    if (!(await Version.delete(versionId, id, db))) return null;
    await WebsiteProject.update(id, {}, db);
    return true;
  });
}
