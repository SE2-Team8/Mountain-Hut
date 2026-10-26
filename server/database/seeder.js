import db from "../config/db.js";
import crypto from "crypto";

const users = [
    { id: 1, username: 'admin', hashed_password: 'strong_password' }
];

users.forEach((user) => {
    user.salt = crypto.randomBytes(16).toString('hex');
    user.hashed_password = crypto.scryptSync(user.hashed_password, user.salt, 64).toString('hex');
});

db.serialize(() => {
    users.forEach((user) => {
        db.run(
            "INSERT INTO users (id, username, hashed_password, salt) VALUES (?, ?, ?, ?)",
            [user.id, user.username, user.hashed_password, user.salt]
        );
    });
});

db.close();