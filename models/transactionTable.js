import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema(
  {
    isPaid: {
      type: Boolean,
      default: false,
      index: true,
    },

    planId: {
      type: String,
      required: true,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    credits: {
      type: Number,
      required: true,
      min: 0,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending",
    },

    paymentProvider: {
      type: String,
      enum: ["Stripe", "Razorpay", "Paypal"],
    },

    paymentIntentId: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Transaction", TransactionSchema);
