import { queryGet } from "../utils/query.js";

async function getUserById(id) {
    const user = await queryGet('SELECT * FROM users WHERE id = ?', [id]);

    if (!user) return false;

    return {
        id: user.id,
        username: user.username
    }
}

export { getUserById };