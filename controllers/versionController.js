import { asyncErrorHandler } from "../middleware/asyncErrorHandler.js";
import ErrorHandler from "../middleware/errorMiddleware.js";
import * as versionService from "../services/versionService.js";

export const saveVersion = asyncErrorHandler(async (req, res, next) => {
  const { projectId } = req.params;
  const { description } = req.body;

  const version = await versionService.saveVersion(
    projectId,
    req.user._id,
    description,
  );

  if (!version) {
    return next(new ErrorHandler("Project not found or access denied", 404));
  }

  res.status(201).json({
    success: true,
    message: "Version saved successfully",
    version,
  });
});

export const getVersions = asyncErrorHandler(async (req, res, next) => {
  const { projectId } = req.params;

  const result = await versionService.getVersions(projectId, req.user._id);

  if (!result) {
    return next(new ErrorHandler("Project not found or access denied", 404));
  }

  res.status(200).json({
    success: true,
    versions: result.versions,
    currentVersionIndex: result.currentVersionIndex,
  });
});

export const getVersionById = asyncErrorHandler(async (req, res, next) => {
  const { projectId, versionId } = req.params;

  const version = await versionService.getVersionById(
    projectId,
    versionId,
    req.user._id,
  );

  if (!version) {
    return next(new ErrorHandler("Version not found", 404));
  }

  res.status(200).json({ success: true, version });
});

export const restoreVersion = asyncErrorHandler(async (req, res, next) => {
  const { projectId, versionId } = req.params;

  const project = await versionService.restoreVersion(
    projectId,
    versionId,
    req.user._id,
  );

  if (!project) {
    return next(new ErrorHandler("Version not found", 404));
  }

  res.status(200).json({
    success: true,
    message: "Version restored successfully",
    project,
  });
});

export const deleteVersion = asyncErrorHandler(async (req, res, next) => {
  const { projectId, versionId } = req.params;

  const success = await versionService.deleteVersion(
    projectId,
    versionId,
    req.user._id,
  );

  if (!success) {
    return next(new ErrorHandler("Project not found or access denied", 404));
  }

  res.status(200).json({
    success: true,
    message: "Version deleted successfully",
  });
});
