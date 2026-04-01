import { asyncErrorHandler } from "../middleware/asyncErrorHandler.js";
import ErrorHandler from "../middleware/errorMiddleware.js";
import * as projectService from "../services/projectService.js";
import { checkIsVerified } from "../utils/cheackIsVerified.js";

export const createProject = asyncErrorHandler(async (req, res, next) => {
  const { websiteName, initialPrompt } = req.body;
  const userId = req.user._id;
  const isVerified = await checkIsVerified(userId);

  // console.log("====================================");
  // console.log("controller");
  // console.table({ websiteName, initialPrompt, isVerified, userId });
  // console.log("====================================");
  if (!isVerified.verified) {
    return next(
      new ErrorHandler("Please verify your email to access this feature", 403),
    );
  }

  if (!websiteName?.trim() || !initialPrompt?.trim()) {
    return next(new ErrorHandler("Please provide all required fields", 400));
  }

  const project = await projectService.createProject(
    userId,
    { websiteName, initialPrompt },
    next,
  );

  if (!project) {
    return next(new ErrorHandler("Project creation failed", 500));
  }

  res.status(201).json({
    success: true,
    message: "Project created successfully",
    WebsiteProject: project,
  });
});

export const getUserProjects = asyncErrorHandler(async (req, res, next) => {
  const projects = await projectService.getUserProjects(req.user._id);
  res.status(200).json({ success: true, projects });
});

export const getCommunityProjects = asyncErrorHandler(
  async (req, res, next) => {
    const projects = await projectService.getCommunityProjects();
    res.status(200).json({ success: true, projects });
  },
);

export const getCommunityProjectById = asyncErrorHandler(
  async (req, res, next) => {
    const { id } = req.params;
    const project = await projectService.getCommunityProjectById(
      id,
      req.user._id,
    );

    if (!project) {
      return next(new ErrorHandler("Community project not found", 404));
    }

    res.status(200).json({ success: true, project });
  },
);

export const getProjectById = asyncErrorHandler(async (req, res, next) => {
  const { id } = req.params;
  const project = await projectService.getProjectById(id, req.user._id);

  if (!project) {
    return next(new ErrorHandler("Project not found or access denied", 404));
  }

  res.status(200).json({ success: true, project });
});

export const projectVisibility = asyncErrorHandler(async (req, res, next) => {
  const { projectId } = req.params;
  const { isPublished } = req.body;

  const project = await projectService.updateProjectVisibility(
    projectId,
    req.user._id,
    isPublished,
  );

  if (!project) {
    return next(new ErrorHandler("Project not found or access denied", 404));
  }

  res.status(200).json({
    success: true,
    message: "Project visibility updated successfully",
    project,
  });
});

export const deleteProject = asyncErrorHandler(async (req, res, next) => {
  const { projectId } = req.params;
  const deleted = await projectService.deleteProject(projectId, req.user._id);

  if (!deleted) {
    return next(new ErrorHandler("Project not found or access denied", 404));
  }

  res.status(200).json({
    success: true,
    message: "Project deleted successfully",
  });
});

export const editProject = asyncErrorHandler(async (req, res, next) => {
  const { projectId } = req.params;
  const { websiteName, prompt } = req.body;

  const project = await projectService.editProject(
    projectId,
    req.user._id,
    { websiteName, prompt },
    next,
  );

  if (!project) {
    return next(new ErrorHandler("Project not found or access denied", 404));
  }

  res.status(200).json({
    success: true,
    message: "Project updated successfully",
    project,
  });
});
