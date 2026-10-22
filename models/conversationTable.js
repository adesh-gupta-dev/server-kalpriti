import * as database from "../config/database.js";
import { newId, conversationRecord } from "../db/records.js";
export default {
  async create({ role, content, projectId }, db = database) {
    return conversationRecord(
      (
        await db.query(
          "INSERT INTO conversations(id,project_id,role,content,position) SELECT $1,$2,$3,$4,COALESCE(MAX(position)+1,0) FROM conversations WHERE project_id=$2 RETURNING *",
          [newId(), projectId, role, content],
        )
      ).rows[0],
    );
  },
  async findForProject(projectId, db = database) {
    return (
      await db.query(
        "SELECT * FROM conversations WHERE project_id=$1 ORDER BY position",
        [projectId],
      )
    ).rows.map(conversationRecord);
  },
};
