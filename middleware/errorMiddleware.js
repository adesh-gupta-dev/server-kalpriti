class ErrorHandler extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const handleError = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const databaseUnavailable = err.code === "DATABASE_UNAVAILABLE";
  err.statusCode = err.statusCode || 500;
  err.message = err.message || "Internal Server Error";

  if (err.code === "23505")
    err = new ErrorHandler("Duplicate field value entered.", 400);

  if (["23502", "23503", "23514", "22P02"].includes(err.code))
    err = new ErrorHandler("Invalid database field or related record.", 400);

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors)
      .map((v) => v.message)
      .join(", ");
    err = new ErrorHandler(messages, 400);
  }

  if (err.name === "JsonWebTokenError")
    err = new ErrorHandler("Invalid JWT token. Please log in again.", 401);

  if (err.name === "TokenExpiredError")
    err = new ErrorHandler("JWT token expired. Please log in again.", 401);

  if (err.code === "DATABASE_UNAVAILABLE")
    err = new ErrorHandler(
      "The database is temporarily unavailable. Please try again shortly.",
      503,
    );

  // Internal SQL, hostnames, credentials, and stack traces stay off the wire.
  const message =
    err.statusCode >= 500
      ? databaseUnavailable
        ? "The database is temporarily unavailable. Please try again shortly."
        : err.statusCode === 503
          ? "This service is temporarily unavailable. Please try again shortly."
          : "Unable to complete this request right now. Please try again."
      : err.message;
  if (err.statusCode >= 500)
    console.error("API request failed", {
      code: err.code || "INTERNAL_ERROR",
      route: req.route?.path || "unmatched",
    });

  res.status(err.statusCode).json({
    success: false,
    message,
  });
};

export default ErrorHandler;
