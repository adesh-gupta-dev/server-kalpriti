import jwt from "jsonwebtoken";
import { asyncErrorHandler } from "./asyncErrorHandler.js";
import ErrorHandler from "./errorMiddleware.js";
import { User } from "../models/index.js";
import { config } from "../config/index.js";

export const isAuthenticated = asyncErrorHandler(async (req, res, next) => {
  const { token } = req.cookies;

  if (!token) {
    return next(new ErrorHandler("Please login to access this resource", 401));
  }
  let decoded;
  try {
    decoded = jwt.verify(token.toString(), config.jwt.secret);
  } catch (error) {
    return next(new ErrorHandler("Invalid token", 401));
  }
  const user = await User.findById(decoded.id);
  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }
  req.user = user;
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
