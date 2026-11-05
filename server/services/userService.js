import { getUserById } from "../repositories/userRepository.js";

async function getUser(userId) {
    return await getUserById(userId);
}

export { getUser }