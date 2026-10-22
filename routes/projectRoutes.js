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
import { validateBody } from "../middleware/validateBody.js";

const router = express.Router();

router.post("/create", isAuthenticated, validateBody("project"), createProject);
router.get("/my-projects", isAuthenticated, getUserProjects);
router.get("/community", isAuthenticated, getCommunityProjects);
router.get("/community/:id", isAuthenticated, getCommunityProjectById);
router.get("/:id", isAuthenticated, getProjectById);
router.put(
  "/visibility/:projectId",
  isAuthenticated,
  validateBody("visibility"),
  projectVisibility,
);
router.put(
  "/edit/:projectId",
  isAuthenticated,
  validateBody("editProject"),
  editProject,
);
router.delete("/:projectId", isAuthenticated, deleteProject);

export default router;
