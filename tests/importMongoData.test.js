import assert from "node:assert/strict";
import { test, beforeEach, after } from "node:test";
import bcrypt from "bcryptjs";
import { testDatabase } from "./helpers/database.js";
import { prepareMongoData, importMongoData } from "../db/importMongoData.js";
const db = await testDatabase();
const { withTransaction } = await import("../config/database.js");
const { User, WebsiteProject } = await import("../models/index.js");
const hash = await bcrypt.hash("legacy-password", 4);
const fixture = () => ({
  users: [
    {
      _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
      name: "Legacy",
      email: "legacy@example.test",
      password: hash,
      credits: 55,
      totalCreation: 7,
      verified: true,
      createdAt: new Date("2025-01-01"),
    },
  ],
  websiteprojects: [
    {
      _id: "bbbbbbbbbbbbbbbbbbbbbbbb",
      name: "Existing site",
      initial_prompt: "Original prompt",
      current_code: "<h1>Current</h1>",
      user_Id: "aaaaaaaaaaaaaaaaaaaaaaaa",
      versions: ["222222222222222222222222", "111111111111111111111111"],
      current_version_index: "1",
      conversation: ["333333333333333333333333"],
    },
  ],
  versions: [
    {
      _id: "111111111111111111111111",
      projectId: "bbbbbbbbbbbbbbbbbbbbbbbb",
      code: "first",
    },
    {
      _id: "222222222222222222222222",
      projectId: "bbbbbbbbbbbbbbbbbbbbbbbb",
      code: "second",
    },
  ],
  conversations: [
    {
      _id: "333333333333333333333333",
      projectId: "bbbbbbbbbbbbbbbbbbbbbbbb",
      role: "user",
      content: "Original chat",
    },
  ],
  transactions: [
    {
      _id: "444444444444444444444444",
      userId: "aaaaaaaaaaaaaaaaaaaaaaaa",
      planId: "plan_basic_10",
      amount: 50,
      credits: 20,
      isPaid: true,
      paymentStatus: "Paid",
      paymentIntentId: "pi_legacy",
    },
  ],
});
beforeEach(() => db.reset());
after(() => db.engine.close());
test("imports unchanged identities, password hashes, balances, history order, and paid markers", async () => {
  const prepared = prepareMongoData(fixture());
  await withTransaction((client) => importMongoData(client, prepared));
  const user = await User.findById("aaaaaaaaaaaaaaaaaaaaaaaa");
  assert.equal(user.password, hash);
  assert.ok(await bcrypt.compare("legacy-password", user.password));
  assert.equal(user.credits, 55);
  assert.equal(user.totalCreation, 7);
  assert.equal(user.createdAt.toISOString(), "2025-01-01T00:00:00.000Z");
  const project = await WebsiteProject.findById("bbbbbbbbbbbbbbbbbbbbbbbb");
  assert.deepEqual(project.versions, [
    "222222222222222222222222",
    "111111111111111111111111",
  ]);
  assert.equal(project.current_version_index, "1");
  assert.equal(project.current_code, "<h1>Current</h1>");
  assert.equal(
    (await db.query("SELECT credits_applied FROM payment_transactions")).rows[0]
      .credits_applied,
    true,
  );
});
test("refuses a nonempty PostgreSQL target without modifying it", async () => {
  await User.create({
    name: "Existing",
    email: "existing@example.test",
    password: "keep",
  });
  await assert.rejects(
    withTransaction((client) =>
      importMongoData(client, prepareMongoData(fixture())),
    ),
    /must be empty/,
  );
  assert.equal(
    (await db.query("SELECT count(*) AS count FROM users")).rows[0].count,
    1,
  );
});
test("a failed import rolls back every table", async () => {
  const source = fixture();
  source.transactions[0].amount = -1;
  await assert.rejects(
    withTransaction((client) =>
      importMongoData(client, prepareMongoData(source)),
    ),
  );
  for (const table of [
    "users",
    "projects",
    "project_versions",
    "conversations",
    "payment_transactions",
  ])
    assert.equal(
      Number(
        (await db.query(`SELECT count(*) AS count FROM ${table}`)).rows[0]
          .count,
      ),
      0,
    );
});
test("refuses orphan records and duplicate normalized emails before transfer", () => {
  const orphan = fixture();
  orphan.versions[0].projectId = "missing";
  assert.throws(() => prepareMongoData(orphan), /missing project/);
  const duplicate = fixture();
  duplicate.users.push({
    ...duplicate.users[0],
    _id: "different",
    email: "LEGACY@EXAMPLE.TEST",
  });
  assert.throws(() => prepareMongoData(duplicate), /Duplicate normalized/);
});
