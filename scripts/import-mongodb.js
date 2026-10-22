import "dotenv/config";
import { MongoClient } from "mongodb";
import { withTransaction, closeDatabase } from "../config/database.js";
import { prepareMongoData, importMongoData } from "../db/importMongoData.js";
const client = process.env.MONGODB_URI
  ? new MongoClient(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    })
  : null;
try {
  if (!client)
    throw new Error(
      "Set MONGODB_URI for the read-only legacy source; DATABASE_URL is the PostgreSQL target",
    );
  if (!process.env.MONGODB_DATABASE)
    throw new Error(
      "Set MONGODB_DATABASE explicitly to the source database name",
    );
  await client.connect();
  const source = client.db(process.env.MONGODB_DATABASE);
  const names = [
    "users",
    "websiteprojects",
    "versions",
    "conversations",
    "transactions",
  ];
  const data = Object.fromEntries(
    await Promise.all(
      names.map(async (name) => [
        name,
        await source.collection(name).find({}).toArray(),
      ]),
    ),
  );
  const prepared = prepareMongoData(data);
  console.log("Validated legacy data:", prepared.counts);
  if (process.argv.includes("--apply")) {
    const counts = await withTransaction((db) => importMongoData(db, prepared));
    console.log("PostgreSQL import committed:", counts);
  } else
    console.log(
      "Dry run only. Stop source writes and back up MongoDB before repeating with --apply.",
    );
} catch (error) {
  console.error("Import failed:", error.message);
  process.exitCode = 1;
} finally {
  await client?.close();
  await closeDatabase();
}
