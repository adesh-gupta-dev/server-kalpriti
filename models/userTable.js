import * as database from "../config/database.js";
import { newId, userRecord } from "../db/records.js";
const columns = {
  name: "name",
  email: "email",
  password: "password",
  role: "role",
  totalCreation: "total_creation",
  credits: "credits",
  resetToken: "reset_token",
  resetTokenExpires: "reset_token_expires",
  otpHash: "otp_hash",
  otpExpiresIn: "otp_expires_in",
  verified: "verified",
};
export default {
  async findById(id, db = database, lock = false) {
    return userRecord(
      (
        await db.query(
          `SELECT * FROM users WHERE id = $1 ${lock ? "FOR UPDATE" : ""}`,
          [id],
        )
      ).rows[0],
    );
  },
  async findByEmail(email, db = database) {
    return userRecord(
      (
        await db.query("SELECT * FROM users WHERE email = $1", [
          email.trim().toLowerCase(),
        ])
      ).rows[0],
    );
  },
  async findByResetToken(token, db = database) {
    return userRecord(
      (await db.query("SELECT * FROM users WHERE reset_token = $1", [token]))
        .rows[0],
    );
  },
  async create({ name, email, password }, db = database) {
    return userRecord(
      (
        await db.query(
          "INSERT INTO users (id,name,email,password) VALUES ($1,$2,$3,$4) RETURNING *",
          [newId(), name.trim(), email.trim().toLowerCase(), password],
        )
      ).rows[0],
    );
  },
  async update(id, updates, db = database) {
    const fields = Object.keys(updates).filter((key) =>
      Object.hasOwn(columns, key),
    );
    if (!fields.length) return this.findById(id, db);
    const values = fields.map((key) =>
      key === "email"
        ? updates[key].trim().toLowerCase()
        : key === "name"
          ? updates[key].trim()
          : updates[key],
    );
    return userRecord(
      (
        await db.query(
          `UPDATE users SET ${fields.map((key, index) => `${columns[key]} = $${index + 2}`).join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`,
          [id, ...values],
        )
      ).rows[0],
    );
  },
  async consumeCredits(id, credits, db = database) {
    return userRecord(
      (
        await db.query(
          "UPDATE users SET credits = credits - $2, total_creation = total_creation + 1, updated_at = now() WHERE id = $1 AND credits >= $2 RETURNING *",
          [id, credits],
        )
      ).rows[0],
    );
  },
  async changePassword(id, expectedHash, password, db = database) {
    return userRecord(
      (
        await db.query(
          "UPDATE users SET password=$3,session_version=session_version+1,reset_token=NULL,reset_token_expires=NULL,updated_at=now() WHERE id=$1 AND password=$2 RETURNING *",
          [id, expectedHash, password],
        )
      ).rows[0],
    );
  },
  async revokeSessions(id, db = database) {
    await db.query(
      "UPDATE users SET session_version=session_version+1,updated_at=now() WHERE id=$1",
      [id],
    );
  },
};
