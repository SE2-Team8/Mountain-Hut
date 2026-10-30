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

// retrieves a user from its id (returns null if not found)
async function getUserById(id) {
    const user = await queryGet('SELECT * FROM users WHERE userId = ?', [id]);

    if (!user) return null;

    return new User(user.userId, user.role, user.fullName, user.email,
		user.phoneNumber, user.notes, user.emergencyContact)
}

// retrieves a user from the given credentials (returns null if not found or credentials are wrong)
async function getUserFromCredentials(email, password) {
	const userRow = await queryGet('SELECT * FROM users WHERE email = ?', [email]);
	if (!userRow) return null;

	const hash = crypto.scryptSync(password, userRow.passwordSalt, PWD_HASH_LEN);
	const credentials_ok = crypto.timingSafeEqual(
		Buffer.from(userRow.passwordHash, "hex"),
		hash
	);

	if (credentials_ok)
		return new User(userRow.userId, userRow.role, userRow.fullName, userRow.email,
		userRow.phoneNumber, userRow.notes, userRow.emergencyContact)
	else
		return null;
}

// creates a user and returns the new user id, throws an error if
// a user with the same email already exists
async function createUser(role, password, fullName, email, phoneNumber, notes = null, emergencyContact = null) {
    const existingUser = await queryGet('SELECT * FROM users WHERE email = ?', [email]);

    if (existingUser)
		throw new Error("User with the same email already exists!");

	const salt = crypto.randomBytes(SALT_LEN).toString('hex');
	const hashedPassword = crypto.scryptSync(password, salt, PWD_HASH_LEN).toString('hex');
    
	const queryRes = await queryRun(
		`INSERT INTO users 
		(passwordHash, passwordSalt, role, fullName, email, phoneNumber, notes, emergencyContact)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[hashedPassword, salt, role, fullName, email, phoneNumber, notes, emergencyContact]
	);

	return queryRes.lastID;
}

// creates a hiker and returns the new user id, throws an error if
// a user with the same email already exists
async function createHiker(password, fullName, email, phoneNumber, notes=null, emergencyContact=null) {
	return await createUser("HIKER", password, fullName, email, phoneNumber, notes, emergencyContact);
}

// creates a warden and returns the new user id, throws an error if
// a user with the same email already exists
async function createWarden(password, fullName, email, phoneNumber = "") {
	return await createUser("WARDEN", password, fullName, email, phoneNumber, null, null);
}

// creates an employee and returns the new user id, throws an error if
// a user with the same email already exists
async function createEmployee(password, fullName, email, phoneNumber = "") {
	return await createUser("EMPLOYEE", password, fullName, email, phoneNumber, null, null);
}


export { User, getUserById, getUserFromCredentials, createHiker, createWarden, createEmployee, PWD_HASH_LEN, SALT_LEN };