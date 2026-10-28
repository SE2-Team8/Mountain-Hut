import { queryGet } from "../utils/query.js";

async function getUserById(id) {
    const user = await queryGet('SELECT * FROM users WHERE id = ?', [id]);

    if (!user) return false;

    return {
        id: user.id,
        username: user.username

		// TODO: change fields and add others
    }
}

// TODO: createUser
// TODO: authenticateUser
// TODO: what to do with user types??? (waiting for reply to issue...)

export { getUserById };