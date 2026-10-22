import express from "express";
import { validateBody } from "../middleware/validateBody.js";
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

router.post(
  "/create",
  isAuthenticated,
  validateBody("payment"),
  createTransaction,
);
router.post(
  "/confirm",
  isAuthenticated,
  validateBody("confirmPayment"),
  confirmTransaction,
);
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
  validateBody("paymentStatus"),
  updateTransactionStatus,
);

export default router;
