import express from "express";
import {
  createTransaction,
  confirmTransaction,
  getUserTransactions,
  getAllTransactions,
  getTransactionById,
  updateTransactionStatus,
} from "../controllers/transactionController.js";
import {
  isAuthenticated,
  authorizeRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/create", isAuthenticated, createTransaction);
router.post("/confirm", isAuthenticated, confirmTransaction);
router.get("/me", isAuthenticated, getUserTransactions);
router.get(
  "/admin/transactions",
  isAuthenticated,
  authorizeRoles("ADMIN"),
  getAllTransactions,
);
router.get(
  "/:id",
  isAuthenticated,
  authorizeRoles("ADMIN"),
  getTransactionById,
);
router.put(
  "/:id",
  isAuthenticated,
  authorizeRoles("ADMIN"),
  updateTransactionStatus,
);

export default router;
