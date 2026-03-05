import jwt from "jsonwebtoken";
import { config } from "../config/index.js";

export function sendToken(user, statusCode, message, res) {
  const token = jwt.sign({ id: user._id }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

  const expiresMs = config.cookie.expiresIn * 24 * 60 * 60 * 1000;

  res
    .status(statusCode)
    .cookie("token", token, {
      expires: new Date(Date.now() + expiresMs),
      httpOnly: true,
      sameSite: config.cookie.sameSite,
      secure: config.cookie.secure,
      path: "/",
    })
    .json({
      success: true,
      message,
      user,
    });

  return token;
}
