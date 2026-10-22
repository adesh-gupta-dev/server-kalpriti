const id = (value) => (value == null ? null : String(value));
const date = (value, fallback = new Date()) =>
  value ? new Date(value) : fallback;
const tables = [
  "users",
  "projects",
  "project_versions",
  "conversations",
  "payment_transactions",
];

// This module is also used by integration tests; it never connects to MongoDB.
export function prepareMongoData(source) {
  const users = source.users || [];
  const projects = source.websiteprojects || [];
  const versions = source.versions || [];
  const conversations = source.conversations || [];
  const transactions = source.transactions || [];
  const userIds = new Set(users.map((user) => id(user._id)));
  const projectIds = new Set(projects.map((project) => id(project._id)));
  for (const project of projects)
    if (!userIds.has(id(project.user_Id)))
      throw new Error(`Project ${id(project._id)} has a missing owner`);
  for (const record of [...versions, ...conversations])
    if (!projectIds.has(id(record.projectId)))
      throw new Error(
        `Record ${id(record._id)} has a missing project; resolve legacy orphan records before importing`,
      );
  for (const payment of transactions)
    if (!userIds.has(id(payment.userId)))
      throw new Error(`Transaction ${id(payment._id)} has a missing user`);
  const emails = users.map((user) => user.email.trim().toLowerCase());
  if (new Set(emails).size !== emails.length)
    throw new Error(
      "Duplicate normalized email addresses must be resolved before importing",
    );
  const ordered = (items, projectId, references = []) => {
    const records = items.filter(
      (item) => id(item.projectId) === id(projectId),
    );
    const byId = new Map(records.map((item) => [id(item._id), item]));
    const referenced = references.map(id);
    for (const key of referenced)
      if (!byId.has(key))
        throw new Error(
          `Project ${id(projectId)} references a missing or unrelated record ${key}`,
        );
    if (new Set(referenced).size !== referenced.length)
      throw new Error(`Project ${id(projectId)} has duplicate references`);
    return [
      ...referenced.map((key) => byId.get(key)),
      ...records
        .filter((item) => !referenced.includes(id(item._id)))
        .sort(
          (a, b) =>
            date(a.timestamp, new Date(0)) - date(b.timestamp, new Date(0)) ||
            id(a._id).localeCompare(id(b._id)),
        ),
    ];
  };
  const groups = projects.map((project) => {
    const projectVersions = ordered(versions, project._id, project.versions);
    const activeIndex = project.current_version_index;
    const activeId =
      activeIndex !== "" && activeIndex != null
        ? project.versions?.[Number(activeIndex)]
        : null;
    const active = activeId
      ? projectVersions.find((version) => id(version._id) === id(activeId))
      : null;
    return {
      project,
      versions: projectVersions,
      conversations: ordered(conversations, project._id, project.conversation),
      currentVersionId: active ? id(active._id) : null,
    };
  });
  return {
    users,
    groups,
    transactions,
    counts: {
      users: users.length,
      projects: projects.length,
      versions: versions.length,
      conversations: conversations.length,
      transactions: transactions.length,
    },
  };
}

export async function importMongoData(db, prepared) {
  await db.query(`LOCK TABLE ${tables.join(",")} IN ACCESS EXCLUSIVE MODE`);
  for (const table of tables) {
    if (
      Number(
        (await db.query(`SELECT count(*) AS count FROM ${table}`)).rows[0]
          .count,
      )
    )
      throw new Error(
        "PostgreSQL target must be empty; no existing data was overwritten",
      );
  }
  for (const user of prepared.users) {
    await db.query(
      "INSERT INTO users(id,name,email,password,role,total_creation,credits,reset_token,reset_token_expires,otp_hash,otp_expires_in,verified,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
      [
        id(user._id),
        user.name.trim(),
        user.email.trim().toLowerCase(),
        user.password,
        user.role || "USER",
        user.totalCreation ?? 0,
        user.credits ?? 20,
        user.resetToken ?? null,
        user.resetTokenExpires ? date(user.resetTokenExpires) : null,
        user.otpHash ?? null,
        user.otpExpiresIn ? date(user.otpExpiresIn) : null,
        user.verified ?? false,
        date(user.createdAt),
        date(user.updatedAt || user.createdAt),
      ],
    );
  }
  for (const {
    project,
    versions,
    conversations,
    currentVersionId,
  } of prepared.groups) {
    const projectId = id(project._id);
    await db.query(
      "INSERT INTO projects(id,name,initial_prompt,current_code,user_id,is_published,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        projectId,
        project.name,
        project.initial_prompt,
        project.current_code ?? null,
        id(project.user_Id),
        project.isPublished ?? false,
        date(project.createdAt),
        date(project.updatedAt || project.createdAt),
      ],
    );
    for (const [position, version] of versions.entries())
      await db.query(
        "INSERT INTO project_versions(id,project_id,code,description,timestamp,position) VALUES($1,$2,$3,$4,$5,$6)",
        [
          id(version._id),
          projectId,
          version.code,
          version.description ?? null,
          date(version.timestamp),
          position,
        ],
      );
    for (const [position, message] of conversations.entries())
      await db.query(
        "INSERT INTO conversations(id,project_id,role,content,timestamp,position) VALUES($1,$2,$3,$4,$5,$6)",
        [
          id(message._id),
          projectId,
          message.role,
          message.content,
          date(message.timestamp),
          position,
        ],
      );
    if (currentVersionId)
      await db.query("UPDATE projects SET current_version_id=$2 WHERE id=$1", [
        projectId,
        currentVersionId,
      ]);
  }
  for (const payment of prepared.transactions) {
    await db.query(
      "INSERT INTO payment_transactions(id,user_id,plan_id,amount,credits,is_paid,credits_applied,payment_status,payment_provider,payment_intent_id,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
      [
        id(payment._id),
        id(payment.userId),
        payment.planId,
        Number(payment.amount),
        payment.credits,
        Boolean(payment.isPaid),
        Boolean(payment.isPaid),
        payment.paymentStatus || "Pending",
        payment.paymentProvider ?? null,
        payment.paymentIntentId || null,
        date(payment.createdAt),
        date(payment.updatedAt || payment.createdAt),
      ],
    );
  }
  const expected = [
    prepared.counts.users,
    prepared.counts.projects,
    prepared.counts.versions,
    prepared.counts.conversations,
    prepared.counts.transactions,
  ];
  for (const [index, table] of tables.entries()) {
    const count = Number(
      (await db.query(`SELECT count(*) AS count FROM ${table}`)).rows[0].count,
    );
    if (count !== expected[index])
      throw new Error(`Imported row count does not match for ${table}`);
  }
  return prepared.counts;
}
