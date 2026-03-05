import express from "express";
import {
  saveVersion,
  getVersions,
  getVersionById,
  restoreVersion,
  deleteVersion,
} from "../controllers/versionController.js";
import { isAuthenticated } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/:projectId/", isAuthenticated, saveVersion);
router.get("/:projectId/all", isAuthenticated, getVersions);
router.get("/:projectId/:versionId", isAuthenticated, getVersionById);
router.put("/:projectId/:versionId/restore", isAuthenticated, restoreVersion);
router.delete("/:projectId/:versionId", isAuthenticated, deleteVersion);

export default router;
