import express from "express";
import {
  createProject,
  getCommunityProjectById,
  getCommunityProjects,
  getProjectById,
  getUserProjects,
  projectVisibility,
  editProject,
  deleteProject,
} from "../controllers/projectController.js";
import { isAuthenticated } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/create", isAuthenticated, createProject);
router.get("/my-projects", isAuthenticated, getUserProjects);
router.get("/community", isAuthenticated, getCommunityProjects);
router.get("/community/:id", isAuthenticated, getCommunityProjectById);
router.get("/:id", isAuthenticated, getProjectById);
router.put("/visibility/:projectId", isAuthenticated, projectVisibility);
router.put("/edit/:projectId", isAuthenticated, editProject);
router.delete("/:projectId", isAuthenticated, deleteProject);

export default router;
