import { queryAll, queryGet, queryRun } from "../utils/query.js";
import crypto from "crypto";

const PWD_HASH_LEN = 64;
const SALT_LEN = 16;

const UserRole = Object.freeze({
  HIKER: "HIKER",
  EMPLOYEE: "EMPLOYEE",
  WARDEN: "WARDEN"
});

function User(userId, role, fullName, email, phoneNumber, notes = null, emergencyContact = null, mustChangePassword = false) {
	this.userId = userId;
	this.role = role;
	this.fullName = fullName;
	this.email = email;
	this.phoneNumber = phoneNumber;
	this.notes = notes;
	this.emergencyContact = emergencyContact;
	this.mustChangePassword = Boolean(mustChangePassword);
}

function isStaff(user) {
	return [UserRole.EMPLOYEE, UserRole.WARDEN].includes(user.role);
}

// retrieves a user from its id (returns null if not found)
async function getUserById(id) {
    const user = await queryGet('SELECT * FROM users WHERE userId = ?', [id]);

    if (!user) return null;

    return new User(user.userId, user.role, user.fullName, user.email,
		user.phoneNumber, user.notes, user.emergencyContact, user.mustChangePassword)
}

// retrieves a user from the given email (returns null if not found)
async function getUserFromEmail(email) {
	const userRow = await queryGet('SELECT * FROM users WHERE email = ?', [email]);
	if (!userRow) return null;

	return new User(userRow.userId, userRow.role, userRow.fullName, userRow.email,
		userRow.phoneNumber, userRow.notes, userRow.emergencyContact, userRow.mustChangePassword)
}
// retrieve a user by email or phone number or name
// at the moment the query returns all information about the user but i'm not sure if everything is needed
async function getHikerbyEmOrPhoneOrName(value) {
	const userRows = await queryAll(
		'SELECT * FROM users WHERE role = ? AND (email LIKE ? OR phoneNumber LIKE ? OR fullName LIKE ?) ORDER BY fullName',
		["HIKER", `%${value}%`, `%${value}%`, `%${value}%`]
	);

	return userRows.map(userRow => new User(userRow.userId, userRow.role, userRow.fullName, userRow.email,
		userRow.phoneNumber, userRow.notes, userRow.emergencyContact, userRow.mustChangePassword));
}

// retrieves a user from the given credentials (returns null if not found or credentials are wrong)
async function getUserFromCredentials(email, password) {
	const userRow = await queryGet('SELECT * FROM users WHERE email = ?', [email]);
	if (!userRow || userRow.mustChangePassword) return null;

	const hash = crypto.scryptSync(password, userRow.passwordSalt, PWD_HASH_LEN);
	const credentials_ok = crypto.timingSafeEqual(
		Buffer.from(userRow.passwordHash, "hex"),
		hash
	);

	if (credentials_ok)
		return new User(userRow.userId, userRow.role, userRow.fullName, userRow.email,
		userRow.phoneNumber, userRow.notes, userRow.emergencyContact, userRow.mustChangePassword)
	else
		return null;
}

function hashPassword(password) {
	const salt = crypto.randomBytes(SALT_LEN).toString("hex");
	const hash = crypto.scryptSync(password, salt, PWD_HASH_LEN).toString("hex");
	return { hash, salt };
}

// creates a user and returns the new user id, throws an error if
// a user with the same email already exists
async function createUser(role, fullName, email, phoneNumber, notes = null, emergencyContact = null, password = null) {
    const existingUser = await queryGet('SELECT * FROM users WHERE email = ?', [email]);

    if (existingUser)
		throw new Error("User with the same email already exists!");

	const mustChangePassword = role === UserRole.HIKER && password === null;
	const { hash, salt } = hashPassword(password?.trim() || crypto.randomBytes(32).toString("hex"));
    
	const queryRes = await queryRun(
		`INSERT INTO users 
		(passwordHash, passwordSalt, role, fullName, email, phoneNumber, notes, emergencyContact, mustChangePassword)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[hash, salt, role, fullName, email, phoneNumber, notes, emergencyContact, Number(mustChangePassword)]
	);

	return queryRes.lastID;
}

// creates a hiker and returns the new user id, throws an error if
// a user with the same email already exists
async function createHiker(fullName, email, phoneNumber, notes=null, emergencyContact=null, password = null) {
	return await createUser("HIKER", fullName, email, phoneNumber, notes, emergencyContact, password);
}

// Sets a new password for the given user and clears the mustChangePassword flag.
// Returns true if the user exists and was updated, false otherwise.
// The current password must be checked before calling this function
async function updatePassword(userId, newPassword) {
	const { salt, hash: hashedPassword } = hashPassword(newPassword);

	const queryRes = await queryRun(
		`UPDATE users
		SET passwordHash = ?, passwordSalt = ?, mustChangePassword = 0
		WHERE userId = ?`, 
		[hashedPassword, salt, userId]
	);

	return queryRes.changes > 0;
}

async function storePasswordSetupToken(userId, tokenHash, expiresAt) {
	const result = await queryRun(`UPDATE users SET passwordSetupTokenHash = ?, passwordSetupExpiresAt = ?
		WHERE userId = ? AND role = 'HIKER' AND mustChangePassword = 1 AND passwordSetupTokenHash IS NULL`,
	[tokenHash, expiresAt, userId]);
	return result.changes === 1;
}

async function setInitialPassword(tokenHash, password) {
	const pending = await queryGet(`SELECT userId FROM users
		WHERE passwordSetupTokenHash = ? AND passwordSetupExpiresAt > ? AND role = 'HIKER' AND mustChangePassword = 1`,
	[tokenHash, Date.now()]);
	if (!pending) return false;

	const { hash, salt } = hashPassword(password);
	const result = await queryRun(`UPDATE users SET passwordHash = ?, passwordSalt = ?, mustChangePassword = 0,
		passwordSetupTokenHash = NULL, passwordSetupExpiresAt = NULL
		WHERE userId = ? AND passwordSetupTokenHash = ? AND passwordSetupExpiresAt > ?
		AND role = 'HIKER' AND mustChangePassword = 1`,
	[hash, salt, pending.userId, tokenHash, Date.now()]);
	return result.changes === 1;
}

// stores the hash of a new password reset token for the user, replacing the previous one: only the last sent works
async function storePasswordResetToken(userId, tokenHash, expiresAt) {
	const result = await queryRun(
		`UPDATE users
		SET passwordResetTokenHash = ?, passwordResetExpiresAt = ?
		WHERE userId = ?`,
		[tokenHash, expiresAt, userId]
	);

	return result.changes === 1;
}

// returns {userId, expiresAt} for the given token hash, or null if no user has it
async function getPasswordResetToken(tokenHash) {
	const row = await queryGet(
		`SELECT userId, passwordResetExpiresAt
		FROM users
		WHERE passwordResetTokenHash = ?`,
		[tokenHash]
	);

	if (!row) return null;
	return { userId: row.userId, expiresAt: row.passwordResetExpiresAt };
}

// removes the reset token of the user 
async function clearPasswordResetToken(userId) {
	await queryRun(
		`UPDATE users 
		SET passwordResetTokenHash = NULL, passwordResetExpiresAt = NULL
		WHERE userId = ?`,
		[userId]
	);
}

// sets the new password with a valid reset token
// returns true if the password was set, false if the token does not exists, has expired or has just been used
async function resetPasswordWithToken(tokenHash, password) {
	const { hash, salt } = hashPassword(password);
	const result = await queryRun(
		`UPDATE users
		SET passwordHash = ?, passwordSalt = ?, mustChangePassword = 0,
			passwordResetTokenHash = NULL, passwordResetExpiresAt = NULL,
			passwordSetupTokenHash = NULL, passwordSetupExpiresAt = NULL
		WHERE passwordResetTokenHash = ? AND passwordResetExpiresAt > ?`,
		[hash, salt, tokenHash, Date.now()]
	);

	return result.changes === 1;
}


// for future use
// // creates a warden and returns the new user id, throws an error if
// // a user with the same email already exists
// async function createWarden(password, fullName, email, phoneNumber = "") {
// 	return await createUser("WARDEN", password, fullName, email, phoneNumber, null, null);
// }

// // creates an employee and returns the new user id, throws an error if
// // a user with the same email already exists
// async function createEmployee(password, fullName, email, phoneNumber = "") {
// 	return await createUser("EMPLOYEE", password, fullName, email, phoneNumber, null, null);
// }


export {
	UserRole, User, isStaff, getUserById, getUserFromEmail, getHikerbyEmOrPhoneOrName, getUserFromCredentials, createHiker, 
	updatePassword, storePasswordSetupToken, setInitialPassword, storePasswordResetToken, getPasswordResetToken, 
	clearPasswordResetToken, resetPasswordWithToken, hashPassword
};