import sqlite3 from "sqlite3";
import "dotenv/config";

const db = new sqlite3.Database(process.env.DB_CONNECTION, (error) => {
  if (error)
    console.error("Database Connection Error", error);
});

export default db;