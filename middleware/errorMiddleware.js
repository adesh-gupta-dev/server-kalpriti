class ErrorHandler extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const handleError = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || "Internal Server Error";

  if (err.code === 11000)
    err = new ErrorHandler("Duplicate field value entered.", 400);

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors)
      .map(v => v.message)
      .join(", ");
    err = new ErrorHandler(messages, 400);
  }

  if (err.name === "JsonWebTokenError")
    err = new ErrorHandler("Invalid JWT token. Please log in again.", 401);

  if (err.name === "TokenExpiredError")
    err = new ErrorHandler("JWT token expired. Please log in again.", 401);

  res.status(err.statusCode).json({
    success: false,
    message: err.message,
  });
};

export default ErrorHandler;
