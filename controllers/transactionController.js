import { asyncErrorHandler } from "../middleware/asyncErrorHandler.js";
import ErrorHandler from "../middleware/errorMiddleware.js";
import * as transactionService from "../services/transactionService.js";

export const createTransaction = asyncErrorHandler(async (req, res, next) => {
  const { planId, totalPrice } = req.body;
  const userId = req.user._id;

  if (!planId || !totalPrice) {
    return next(new ErrorHandler("Plan ID and total price are required", 400));
  }

  const result = await transactionService.createPaymentTransaction(userId, {
    planId,
    totalPrice,
  });

  if (!result.success) {
    return next(
      new ErrorHandler(
        result.error,
        result.error === "Invalid Plan ID" ? 400 : 500,
      ),
    );
  }

  res.status(200).json({
    success: true,
    message: "Payment intent created successfully",
    price: result.price,
    clientSecret: result.clientSecret,
  });
});

export const getUserTransactions = asyncErrorHandler(async (req, res) => {
  const transactions = await transactionService.getUserTransactions(
    req.user._id,
  );
  res.status(200).json({ success: true, transactions });
});

export const confirmTransaction = asyncErrorHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { paymentIntentId } = req.body;

  const result = await transactionService.confirmPaymentTransaction(
    userId,
    paymentIntentId,
  );

  if (!result.success) {
    return next(new ErrorHandler(result.error, result.statusCode || 400));
  }

  res.status(200).json({
    success: true,
    message: result.alreadyProcessed
      ? "Payment already confirmed"
      : "Payment confirmed successfully",
    transaction: result.transaction,
    creditsAdded: result.creditsAdded,
    alreadyProcessed: result.alreadyProcessed,
  });
});

export const getAllTransactions = asyncErrorHandler(async (req, res) => {
  const transactions = await transactionService.getAllTransactions();
  res.status(200).json({ success: true, transactions });
});

export const getTransactionById = asyncErrorHandler(async (req, res, next) => {
  const { id } = req.params;
  const transaction = await transactionService.getTransactionById(id);

  if (!transaction) {
    return next(new ErrorHandler("Transaction not found", 404));
  }

  res.status(200).json({ success: true, transaction });
});

export const updateTransactionStatus = asyncErrorHandler(
  async (req, res, next) => {
    const { id } = req.params;
    const { paymentStatus } = req.body;

    const transaction = await transactionService.updateTransactionStatus(
      id,
      paymentStatus,
    );

    if (!transaction) {
      return next(new ErrorHandler("Transaction not found", 404));
    }

    res.status(200).json({
      success: true,
      transaction,
    });
  },
);
