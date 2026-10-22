import ErrorHandler from "./errorMiddleware.js";

const text = (min, max) => (value) =>
  typeof value === "string" &&
  value.trim().length >= min &&
  value.length <= max;
const optional = (rule) => (value) => value === undefined || rule(value);
const email = (value) =>
  typeof value === "string" &&
  value.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const password = (value) =>
  typeof value === "string" &&
  value.length >= 8 &&
  value.length <= 64 &&
  Buffer.byteLength(value, "utf8") <= 72;
const oldPassword = (value) =>
  typeof value === "string" &&
  value.length > 0 &&
  Buffer.byteLength(value, "utf8") <= 72;

const schemas = {
  register: { name: text(2, 120), email, password },
  login: { email, password: oldPassword },
  forgotPassword: { email },
  resetPassword: { newPassword: password, confirmPassword: password },
  changePassword: {
    oldPassword,
    newPassword: password,
    confirmPassword: password,
  },
  profile: { name: optional(text(2, 120)), email: optional(email) },
  otp: { otp: (value) => typeof value === "string" && /^\d{6}$/.test(value) },
  project: { websiteName: text(2, 120), initialPrompt: text(8, 20000) },
  editProject: {
    websiteName: optional(text(2, 120)),
    prompt: optional(text(1, 20000)),
    code: optional(text(0, 1000000)),
  },
  visibility: { isPublished: (value) => typeof value === "boolean" },
  message: {
    content: text(1, 1000000),
    role: optional((value) => ["user", "assistant"].includes(value)),
  },
  version: { description: optional(text(0, 500)) },
  payment: {
    planId: text(1, 100),
    totalPrice: (value) =>
      typeof value === "number" && Number.isFinite(value) && value > 0,
  },
  confirmPayment: {
    paymentIntentId: (value) =>
      typeof value === "string" &&
      /^pi_[a-zA-Z0-9_]+$/.test(value) &&
      value.length <= 200,
  },
  paymentStatus: {
    paymentStatus: (value) => ["Pending", "Paid", "Failed"].includes(value),
  },
};

export function validateBody(schemaName) {
  const schema = schemas[schemaName];
  return (req, _res, next) => {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body))
      return next(new ErrorHandler("A JSON object is required", 400));
    if (Object.keys(body).some((key) => !Object.hasOwn(schema, key)))
      return next(new ErrorHandler("Unexpected request field", 400));
    for (const [field, valid] of Object.entries(schema)) {
      if (!valid(body[field])) {
        const message =
          ["password", "newPassword", "confirmPassword"].includes(field) &&
          schemaName !== "login"
            ? "Password must contain 8 to 64 characters and at most 72 UTF-8 bytes"
            : `Invalid or missing ${field}`;
        return next(new ErrorHandler(message, 400));
      }
    }
    if (
      ["profile", "editProject"].includes(schemaName) &&
      !Object.keys(body).length
    )
      return next(new ErrorHandler("Nothing to update", 400));
    return next();
  };
}
