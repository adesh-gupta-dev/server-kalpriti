import jwt from "jsonwebtoken";
import { asyncErrorHandler } from "./asyncErrorHandler.js";
import ErrorHandler from "./errorMiddleware.js";
import { User } from "../models/index.js";
import { config } from "../config/index.js";
import { validCsrfToken } from "../utils/csrf.js";

export const isAuthenticated = asyncErrorHandler(async (req, res, next) => {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7).trim()
    : null;
  const token = bearer || req.cookies?.token;

  if (!token) {
    return next(new ErrorHandler("Please login to access this resource", 401));
  }
  let decoded;
  try {
    decoded = jwt.verify(token.toString(), config.jwt.secret, {
      algorithms: ["HS256"],
    });
  } catch (error) {
    return next(new ErrorHandler("Invalid token", 401));
  }
  const user = await User.findById(decoded.id);
  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }
  if (
    !Number.isInteger(decoded.sv ?? 0) ||
    (decoded.sv ?? 0) !== user.sessionVersion
  )
    return next(
      new ErrorHandler("Your session expired. Please sign in again.", 401),
    );
  if (
    !bearer &&
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    !validCsrfToken(req.get("x-csrf-token"), token)
  )
    return next(
      new ErrorHandler("Please refresh the page and try again.", 403),
    );
  req.user = user;
  req.authToken = token;
  next();
});

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorHandler(
          `Role: ${req.user.role} is not allowed to access this resource`,
          403,
        ),
      );
    }
    next();
  };
};
