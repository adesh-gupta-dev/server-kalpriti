import mongoose from "mongoose";
import { config } from "./index.js";

export const connectDatabase = async () => {
  try {
    const conn = await mongoose.connect(config.database.url, {});
    console.log(`Database connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("Database connection error:", error.message);
    process.exit(1);
  }
};
