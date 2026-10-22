import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import helmet from "helmet";

import { config } from "./config/index.js";
import { connectDatabase, closeDatabase } from "./config/database.js";
import { handleError } from "./middleware/errorMiddleware.js";
import { handleStripeWebhook } from "./controllers/webhookController.js";
import { liveness, readiness } from "./controllers/healthController.js";
import {
  isAllowedOrigin,
  productionConfigurationIssues,
  proxySetting,
} from "./config/security.js";
import ErrorHandler from "./middleware/errorMiddleware.js";

import authRoutes from "./routes/authRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";
import versionRoutes from "./routes/versionRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import cors from "cors";
import limiter, { closeRateLimitStore } from "./utils/rateLimiter.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", proxySetting());
app.use(helmet());
app.get(["/live", "/health/live"], liveness);
app.get(["/check", "/ready", "/health/ready"], readiness);
app.use((_req, _res, next) =>
  productionConfigurationIssues().length
    ? next(
        new ErrorHandler(
          "This service is temporarily unavailable. Please try again shortly.",
          503,
        ),
      )
    : next(),
);
app.use((req, _res, next) =>
  isAllowedOrigin(req.get("origin"))
    ? next()
    : next(new ErrorHandler("This origin is not allowed", 403)),
);
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, Boolean(origin) && isAllowedOrigin(origin));
    },
    credentials: true,
  }),
);

app.post(
  ["/api/payment/webhook", "/payment/webhook"],
  express.raw({ type: "application/json" }),
  handleStripeWebhook,
);

app.use(limiter);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: false, limit: "16kb" }));

app.use("/api/auth", authRoutes);
app.use("/project", projectRoutes);
app.use("/conversation", conversationRoutes);
app.use("/version", versionRoutes);
app.use("/payment", paymentRoutes);

app.use(handleError);

export { app };
export async function startServer() {
  for (const issue of productionConfigurationIssues())
    console.error(`Configuration: ${issue}`);
  await connectDatabase();
  const server = app.listen(config.port, () =>
    console.log(`Server is running on port ${config.port}`),
  );
  const shutdown = () => {
    const deadline = setTimeout(() => {
      server.closeAllConnections();
      void closeDatabase();
    }, 30000);
    deadline.unref();
    server.close(() => {
      clearTimeout(deadline);
      void Promise.allSettled([closeDatabase(), closeRateLimitStore()]);
    });
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  return server;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await startServer();
  } catch (error) {
    console.error("Server startup failed:", error.message);
    await closeDatabase();
    process.exitCode = 1;
  }
}
