import * as database from "../config/database.js";
import { newId, projectRecord } from "../db/records.js";
const selection = `SELECT p.*, ARRAY(SELECT id FROM project_versions WHERE project_id=p.id ORDER BY position) AS version_ids, ARRAY(SELECT id FROM conversations WHERE project_id=p.id ORDER BY position) AS conversation_ids FROM projects p`;
export default {
  async findById(id, db = database) {
    return projectRecord(
      (await db.query(`${selection} WHERE p.id=$1`, [id])).rows[0],
    );
  },
  async findOwned(id, userId, db = database, lock = false) {
    return projectRecord(
      (
        await db.query(
          `${selection} WHERE p.id=$1 AND p.user_id=$2 ${lock ? "FOR UPDATE OF p" : ""}`,
          [id, userId],
        )
      ).rows[0],
    );
  },
  async findForUser(userId, db = database) {
    return (
      await db.query(
        `${selection} WHERE p.user_id=$1 ORDER BY p.created_at DESC, p.id`,
        [userId],
      )
    ).rows.map(projectRecord);
  },
  async community(id, db = database) {
    const rows = (
      await db.query(
        `SELECT p.*, u.name AS owner_name FROM projects p JOIN users u ON u.id=p.user_id WHERE p.is_published=true ${id ? "AND p.id=$1" : ""} ORDER BY p.updated_at DESC, p.id`,
        id ? [id] : [],
      )
    ).rows;
    return rows.map((row) => {
      const project = projectRecord(row);
      const {
        conversation,
        versions,
        current_version_index,
        current_code,
        ...publicProject
      } = project;
      return {
        ...publicProject,
        ...(id ? { current_code } : {}),
        isInitialPromptVisible: true,
        ownerName: row.owner_name,
      };
    });
  },
  async create({ name, initial_prompt, current_code, user_Id }, db = database) {
    const id = newId();
    await db.query(
      "INSERT INTO projects(id,name,initial_prompt,current_code,user_id) VALUES($1,$2,$3,$4,$5)",
      [id, name, initial_prompt, current_code, user_Id],
    );
    return this.findById(id, db);
  },
  async update(id, changes, db = database) {
    const columns = {
      name: "name",
      current_code: "current_code",
      currentVersionId: "current_version_id",
      isPublished: "is_published",
    };
    const fields = Object.keys(changes).filter((key) =>
      Object.hasOwn(columns, key),
    );
    await db.query(
      `UPDATE projects SET ${fields
        .map((key, i) => `${columns[key]}=$${i + 2}`)
        .concat("updated_at=now()")
        .join(",")} WHERE id=$1`,
      [id, ...fields.map((key) => changes[key])],
    );
    return this.findById(id, db);
  },
  async deleteOwned(id, userId, db = database) {
    return (
      (
        await db.query("DELETE FROM projects WHERE id=$1 AND user_id=$2", [
          id,
          userId,
        ])
      ).rowCount > 0
    );
  },
};
