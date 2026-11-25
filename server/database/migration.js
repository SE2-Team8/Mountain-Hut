import db from "../config/db.js"

function createDBTables() {
	const stmts = [
	`DROP TABLE IF EXISTS tableAssignments`,
	`DROP TABLE IF EXISTS tables`,
	`DROP TABLE IF EXISTS reservations`,
	`DROP TABLE IF EXISTS timeSlots`,
	`DROP TABLE IF EXISTS users`,
	`CREATE TABLE IF NOT EXISTS users (
		userId INTEGER PRIMARY KEY AUTOINCREMENT,
		passwordHash TEXT NOT NULL,
		passwordSalt TEXT NOT NULL,
		role TEXT NOT NULL CHECK (role IN ('HIKER', 'EMPLOYEE', 'WARDEN')),
		fullName TEXT NOT NULL,
		email TEXT UNIQUE NOT NULL,
		phoneNumber TEXT NOT NULL,
		notes TEXT,
		emergencyContact TEXT,
		mustChangePassword INTEGER NOT NULL DEFAULT 0 CHECK (mustChangePassword IN (0, 1)),
		passwordSetupTokenHash TEXT UNIQUE,
		passwordSetupExpiresAt INTEGER
	)`,
	`CREATE TABLE IF NOT EXISTS timeSlots (
		timeSlotId INTEGER PRIMARY KEY AUTOINCREMENT,
		startDateTime TEXT UNIQUE NOT NULL,
		endDateTime TEXT NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS reservations (
		reservId INTEGER PRIMARY KEY AUTOINCREMENT,
		userId INTEGER NOT NULL,
		timeSlotId INTEGER NOT NULL,
		partySize INTEGER NOT NULL,
		dietaryRequirements TEXT NOT NULL,
		temporaryHikerName TEXT,
		temporaryHikerPhone TEXT,
		FOREIGN KEY (userId) REFERENCES users(userId),
		FOREIGN KEY (timeSlotId) REFERENCES timeSlots(timeSlotId)
	)`,
	`CREATE TABLE IF NOT EXISTS tables (
		tableId INTEGER PRIMARY KEY AUTOINCREMENT,
		tableNumber INTEGER NOT NULL,
		totalSeats INTEGER NOT NULL DEFAULT 0,
		freeSeats INTEGER NOT NULL DEFAULT 0,
		timeSlotId INTEGER NOT NULL,
		FOREIGN KEY (timeSlotId) REFERENCES timeSlots(timeSlotId),
		UNIQUE (timeSlotId, tableNumber)
	)`,
	`CREATE TABLE IF NOT EXISTS tableAssignments (
		tableId INTEGER NOT NULL,
		reservId INTEGER NOT NULL,
		occupiedSeats INTEGER NOT NULL,
		PRIMARY KEY (tableId, reservId),
		FOREIGN KEY (tableId) REFERENCES tables(tableId),
		FOREIGN KEY (reservId) REFERENCES reservations(reservId)
	)`,
	];

	const sql = stmts.join(";\n");
	return new Promise((resolve, reject) => {
		db.exec(sql, (err) => (err ? reject(err) : resolve()));
	})
}


function deleteDBData() {
	const stmts = [
	`DELETE FROM tableAssignments`,
	`DELETE FROM tables`,
	`DELETE FROM timeSlots`,
	`DELETE FROM reservations`,
	`DELETE FROM users`,
	`DELETE FROM sqlite_sequence`,
	];

	const sql = stmts.join(";\n");
	return new Promise((resolve, reject) => {
		db.exec(sql, (err) => (err ? reject(err) : resolve()));
	})
}

if (import.meta.main) {
	await createDBTables();
	db.close();
}

export { createDBTables, deleteDBData };