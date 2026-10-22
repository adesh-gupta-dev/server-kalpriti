import * as database from "../config/database.js";
import { newId, versionRecord } from "../db/records.js";
export default {
  async create({ code, description, projectId }, db = database) {
    return versionRecord(
      (
        await db.query(
          "INSERT INTO project_versions(id,project_id,code,description,position) SELECT $1,$2,$3,$4,COALESCE(MAX(position)+1,0) FROM project_versions WHERE project_id=$2 RETURNING *",
          [newId(), projectId, code, description ?? null],
        )
      ).rows[0],
    );
  },
  async findForProject(projectId, db = database) {
    return (
      await db.query(
        "SELECT * FROM project_versions WHERE project_id=$1 ORDER BY position",
        [projectId],
      )
    ).rows.map(versionRecord);
  },
  async findById(id, projectId, db = database) {
    return versionRecord(
      (
        await db.query(
          "SELECT * FROM project_versions WHERE id=$1 AND project_id=$2",
          [id, projectId],
        )
      ).rows[0],
    );
  },
  async delete(id, projectId, db = database) {
    return (
      (
        await db.query(
          "DELETE FROM project_versions WHERE id=$1 AND project_id=$2",
          [id, projectId],
        )
      ).rowCount > 0
    );
  },
};
