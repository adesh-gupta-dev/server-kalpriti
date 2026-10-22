import assert from "node:assert/strict";
import { test, mock, beforeEach, after } from "node:test";
import { testDatabase } from "./helpers/database.js";
const db = await testDatabase();
let aiCalls = 0;
mock.module("../utils/websiteGeneration.js", {
  namedExports: {
    build: async () => "<h1>Initial</h1>",
    update: async () => {
      aiCalls++;
      return "<h1>AI edit</h1>";
    },
  },
});
const projects = await import("../services/projectService.js");
const versions = await import("../services/versionService.js");
const conversations = await import("../services/conversationService.js");
const { User } = await import("../models/index.js");
let owner, stranger, project;
beforeEach(async () => {
  await db.reset();
  aiCalls = 0;
  owner = await User.create({
    name: "Owner",
    email: "owner@example.test",
    password: "hashed",
  });
  stranger = await User.create({
    name: "Other",
    email: "other@example.test",
    password: "hashed",
  });
  project = await projects.createProject(owner._id, {
    websiteName: "Example",
    initialPrompt: "initial",
  });
});
after(() => db.engine.close());
test("creates project, initial conversation, version, and credit usage together", async () => {
  assert.equal(project.versions.length, 1);
  assert.equal(project.current_version_index, "0");
  assert.equal(project.conversation.length, 2);
  const user = await User.findById(owner._id);
  assert.equal(user.credits, 15);
  assert.equal(user.totalCreation, 1);
});
test("manual code saves preserve exact code, create a restorable snapshot, and skip AI", async () => {
  const code =
    "<html><body><h1>Native edit</h1><script>const x = 1;</script></body></html>";
  const result = await projects.editProject(project._id, owner._id, { code });
  assert.equal(result.current_code, code);
  assert.equal(result.versions.length, 2);
  assert.equal(result.current_version_index, "1");
  assert.equal(aiCalls, 0);
  const history = await versions.getVersions(project._id, owner._id);
  assert.equal(history.versions[1].code, code);
  assert.equal((await User.findById(owner._id)).credits, 15);
});
test("enforces ownership on project, version, conversation, and publication operations", async () => {
  assert.equal(
    await projects.editProject(project._id, stranger._id, { code: "new" }),
    null,
  );
  assert.equal(await versions.getVersions(project._id, stranger._id), null);
  assert.equal(
    await versions.restoreVersion(
      project._id,
      project.versions[0],
      stranger._id,
    ),
    null,
  );
  assert.equal(
    await conversations.addMessage(project._id, stranger._id, {
      content: "Hello",
    }),
    null,
  );
  assert.equal(
    await projects.updateProjectVisibility(project._id, stranger._id, true),
    null,
  );
  assert.equal(await projects.deleteProject(project._id, stranger._id), false);
});
test("AI edits preserve behavior and charge credits once inside the save transaction", async () => {
  const result = await projects.editProject(project._id, owner._id, {
    prompt: "change hero",
  });
  assert.equal(result.current_code, "<h1>AI edit</h1>");
  assert.equal(aiCalls, 1);
  assert.equal((await User.findById(owner._id)).credits, 12);
});
test("insufficient credits roll back project/version writes", async () => {
  await User.update(owner._id, { credits: 0 });
  await assert.rejects(
    projects.editProject(project._id, owner._id, { prompt: "change hero" }),
    /Insufficient credits/,
  );
  assert.equal(
    (await projects.getProjectById(project._id, owner._id)).versions.length,
    1,
  );
});
test("failed database writes roll back credit deductions and all related records", async () => {
  const before = await User.findById(owner._id);
  await assert.rejects(
    projects.createProject(owner._id, {
      websiteName: " ",
      initialPrompt: "initial",
    }),
  );
  assert.equal((await User.findById(owner._id)).credits, before.credits);
  assert.equal((await projects.getUserProjects(owner._id)).length, 1);
});
test("version ordering and current index remain valid after restore and deletion", async () => {
  const named = await versions.saveVersion(project._id, owner._id, "Snapshot");
  await projects.editProject(project._id, owner._id, { code: "new" });
  await versions.restoreVersion(project._id, named._id, owner._id);
  assert.equal(
    (await versions.getVersions(project._id, owner._id)).currentVersionIndex,
    "1",
  );
  await versions.deleteVersion(project._id, project.versions[0], owner._id);
  assert.equal(
    (await versions.getVersions(project._id, owner._id)).currentVersionIndex,
    "0",
  );
  await versions.deleteVersion(project._id, named._id, owner._id);
  assert.equal(
    (await versions.getVersions(project._id, owner._id)).currentVersionIndex,
    "",
  );
});
test("deleting a project cascades conversations and versions", async () => {
  await projects.deleteProject(project._id, owner._id);
  assert.equal(
    Number(
      (await db.query("SELECT count(*) AS count FROM project_versions")).rows[0]
        .count,
    ),
    0,
  );
  assert.equal(
    Number(
      (await db.query("SELECT count(*) AS count FROM conversations")).rows[0]
        .count,
    ),
    0,
  );
});
test("community listings expose published projects with owner names", async () => {
  assert.equal((await projects.getCommunityProjects()).length, 0);
  await projects.updateProjectVisibility(project._id, owner._id, true);
  const published = await projects.getCommunityProjects();
  assert.equal(published[0].ownerName, "Owner");
  assert.equal(published[0].current_code, undefined);
  assert.equal(
    (await projects.getCommunityProjectById(project._id)).current_code,
    project.current_code,
  );
});
test("chat messages keep deterministic order and database constraints reject invalid roles", async () => {
  await conversations.addMessage(project._id, owner._id, {
    content: "  hello  ",
  });
  const messages = await conversations.getConversations(project._id, owner._id);
  assert.equal(messages[2].content, "hello");
  await assert.rejects(
    conversations.addMessage(project._id, owner._id, {
      content: "bad",
      role: "admin",
    }),
  );
  assert.equal(
    (await conversations.getConversations(project._id, owner._id)).length,
    3,
  );
});
