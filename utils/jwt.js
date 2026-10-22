import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { csrfTokenFor } from "./csrf.js";

export function sendToken(user, statusCode, message, res, sessionVersion = 0) {
  const token = jwt.sign(
    { id: user._id, sv: sessionVersion },
    config.jwt.secret,
    {
      algorithm: "HS256",
      expiresIn: config.jwt.expiresIn,
    },
  );

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
      token,
      csrfToken: csrfTokenFor(token),
    });

  return token;
}
