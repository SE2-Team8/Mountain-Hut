import { getHikerbyEmOrPhoneOrName, getUserById } from "../repositories/userRepository.js";

async function getUser(userId) {
    return await getUserById(userId);
}

async function searchHikers(value) {
    return await getHikerbyEmOrPhoneOrName(value);
}

export { getUser, searchHikers }