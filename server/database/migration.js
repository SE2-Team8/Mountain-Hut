import db from "../config/db.js"

db.serialize(() => {
  db.run(`DROP TABLE IF EXISTS users`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    salt TEXT NOT NULL
  )`);
});

db.close();