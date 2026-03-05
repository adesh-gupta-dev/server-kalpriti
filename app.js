import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import { existsSync } from "fs";

import { config } from "./config/index.js";
import { connectDatabase } from "./config/database.js";
import { handleError } from "./middleware/errorMiddleware.js";
import { handleStripeWebhook } from "./controllers/webhookController.js";

import authRoutes from "./routes/authRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";
import versionRoutes from "./routes/versionRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import cors from "cors";

const app = express();

const isLocalOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
const isPrivateLanOrigin = (origin) =>
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/i.test(origin);
const allowedOrigins = new Set(
  [
    config.clientUrl,
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "192.168.1.15:5173",
  ].filter(Boolean),
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (
        allowedOrigins.has(origin) ||
        isLocalOrigin(origin) ||
        (config.env !== "production" && isPrivateLanOrigin(origin))
      ) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }),
);
// Health/check route
app.get("/check", (_req, res) => {
  const outputFile = path.join(process.cwd(), "output", "index.html");
  if (existsSync(outputFile)) {
    res.sendFile(outputFile);
    return;
  }

  res.status(200).json({
    ok: true,
    service: "kalpriti-api",
    env: config.env,
    port: config.port,
  });
});

// Stripe webhook - must use raw body, register BEFORE express.json()
app.post(
  ["/api/payment/webhook", "/payment/webhook"],
  express.raw({ type: "application/json" }),
  handleStripeWebhook,
);

// Global middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// API routes (preserving original paths for backward compatibility)
app.use("/api/auth", authRoutes);
app.use("/project", projectRoutes);
app.use("/conversation", conversationRoutes);
app.use("/version", versionRoutes);
app.use("/payment", paymentRoutes);

// Error handler
app.use(handleError);

// Database and server
connectDatabase();

app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
});
