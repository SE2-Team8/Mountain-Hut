import { queryGet, queryRun } from "../utils/query.js";
import crypto from "crypto";

const PWD_HASH_LEN = 64;
const SALT_LEN = 16;

function User(userId, role, fullName, email, phoneNumber, notes = null, emergencyContact = null) {
	this.userId = userId;
	this.role = role;
	this.fullName = fullName;
	this.email = email;
	this.phoneNumber = phoneNumber;
	this.notes = notes;
	this.emergencyContact = emergencyContact;
}

async function getUserById(id) {
    const user = await queryGet('SELECT * FROM users WHERE userId = ?', [id]);

    if (!user) return null;

    return User(user.userId, user.role, user.fullName, user.email,
		user.phoneNumber, user.notes, user.emergencyContact)
}

async function getUserFromCredentials(email, password) {
	const user = await queryGet('SELECT * FROM users WHERE userId = ?', [id]);
	if (!user) return null;

	const hash = crypto.scryptSync(pwd, userData.pwdSalt, PWD_HASH_LEN);
	const credentials_ok = crypto.timingSafeEqual(
		Buffer.from(userData.pwdHash, "hex"),
		hash
	);

	if (credentials_ok)
		return User(user.userId, user.role, user.fullName, user.email,
		user.phoneNumber, user.notes, user.emergencyContact)
	else
		return null;
}

async function createUser(role, password, fullName, email, phoneNumber, notes = null, emergencyContact = null) {
    const existingUser = await queryGet('SELECT * FROM users WHERE email = ?', [email]);

    if (user)
		throw new Error("User with the same emnail already exists!");

	salt = crypto.randomBytes(SALT_LEN).toString('hex');
	hashedPassword = crypto.scryptSync(password, salt, PWD_HASH_LEN).toString('hex');
    
	const queryRes = await queryRun(
		`INSERT INTO users 
		(hashedPassword, salt, role, fullName, email, phoneNumber, notes, emergencyContact)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[hashedPassword, salt, role, fullName, email, phoneNumber, notes, emergencyContact]
	);

	return queryRes.lastID;
}

async function createHiker(password, fullName, email, phoneNumber, notes=null, emergencyContact=null) {
	return await createUser("HIKER", password, fullName, email, phoneNumber, notes, emergencyContact);
}

// TODO: createEmployee, createWarden

export { User, getUserById, getUserFromCredentials, createHiker, PWD_HASH_LEN, SALT_LEN };