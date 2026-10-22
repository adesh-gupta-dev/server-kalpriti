import assert from "node:assert/strict";
import { test, mock, beforeEach, after } from "node:test";
import bcrypt from "bcryptjs";
import { testDatabase } from "./helpers/database.js";
const db = await testDatabase();
process.env.JWT_SECRET_KEY = "postgres-integration-test-only";
const sent = [];
mock.module("../utils/email.js", {
  namedExports: {
    sendEmail: async (...args) => {
      sent.push(args);
    },
  },
});
const auth = await import("../services/authService.js");
const { User } = await import("../models/index.js");
const { hashToken } = await import("../utils/crypto.js");
beforeEach(async () => {
  await db.reset();
  sent.length = 0;
});
after(() => db.engine.close());
test("registration normalizes email, hashes passwords, preserves _id API, and hides secrets", async () => {
  const result = await auth.register({
    name: " Owner ",
    email: "OWNER@EXAMPLE.TEST ",
    password: "my-password",
  });
  assert.equal(result.success, true);
  assert.match(result.user._id, /^[a-f0-9]{24}$/);
  assert.equal(result.user.email, "owner@example.test");
  assert.equal(result.user.name, "Owner");
  assert.equal(result.user.credits, 20);
  assert.equal(result.user.password, undefined);
  const stored = await User.findById(result.user._id);
  assert.notEqual(stored.password, "my-password");
  assert.ok(await bcrypt.compare("my-password", stored.password));
  assert.equal(
    (
      await auth.register({
        name: "Duplicate",
        email: "owner@example.test",
        password: "different",
      })
    ).success,
    false,
  );
});
test("login rejects invalid credentials and never returns password/reset/OTP hashes", async () => {
  const user = (
    await auth.register({
      name: "Owner",
      email: "owner@example.test",
      password: "my-password",
    })
  ).user;
  await User.update(user._id, { resetToken: "secret", otpHash: "otp-secret" });
  assert.equal(
    (await auth.login({ email: "OWNER@example.test", password: "wrong" }))
      .success,
    false,
  );
  const login = await auth.login({
    email: "OWNER@example.test",
    password: "my-password",
  });
  assert.equal(login.success, true);
  for (const key of [
    "password",
    "otpHash",
    "otpExpiresIn",
    "resetToken",
    "resetTokenExpires",
  ])
    assert.equal(login.user[key], undefined);
  assert.equal((await auth.getUserById(user._id)).password, undefined);
});
test("password reset consumes an unexpired token once and preserves account identity", async () => {
  const user = await User.create({
    name: "Owner",
    email: "owner@example.test",
    password: "old-hash",
  });
  await User.update(user._id, {
    resetToken: hashToken("reset-token"),
    resetTokenExpires: new Date(Date.now() + 60000),
  });
  const result = await auth.resetPasswordWithToken(
    "reset-token",
    "new-password",
  );
  assert.equal(result.user._id, user._id);
  assert.equal(
    (await auth.login({ email: user.email, password: "new-password" })).success,
    true,
  );
  assert.equal(
    (await auth.resetPasswordWithToken("reset-token", "another-password"))
      .success,
    false,
  );
  await User.update(user._id, {
    resetToken: hashToken("expired"),
    resetTokenExpires: new Date(Date.now() - 1000),
  });
  assert.equal(
    (await auth.resetPasswordWithToken("expired", "new-password")).success,
    false,
  );
});
test("email verification checks hash/expiry, then clears the one-time OTP", async () => {
  const user = await User.create({
    name: "Owner",
    email: "owner@example.test",
    password: "hash",
  });
  await User.update(user._id, {
    otpHash: await bcrypt.hash("123456", 4),
    otpExpiresIn: new Date(Date.now() + 60000),
  });
  assert.equal(
    (await auth.verifyOtpAndConfirm(user._id, "000000")).success,
    false,
  );
  assert.equal(
    (await auth.verifyOtpAndConfirm(user._id, "123456")).success,
    true,
  );
  const updated = await User.findById(user._id);
  assert.equal(updated.verified, true);
  assert.equal(updated.otpHash, null);
  assert.equal(
    (await auth.verifyOtpAndConfirm(user._id, "123456")).success,
    false,
  );
});
test("profile updates cannot inject SQL identifiers or overwrite protected fields through the service", async () => {
  const user = await User.create({
    name: "Owner",
    email: "owner@example.test",
    password: "hash",
  });
  const changed = await auth.updateUserProfile(user._id, {
    name: "O'Neil",
    email: "new@example.test",
    role: "ADMIN",
    credits: 999,
    password: "changed",
  });
  assert.equal(changed.name, "O'Neil");
  assert.equal(changed.password, undefined);
  assert.equal(changed.role, "USER");
  assert.equal(changed.credits, 20);
  assert.equal((await User.findById(user._id)).password, "hash");
  await assert.rejects(auth.updateUserProfile(user._id, { name: " " }));
});
