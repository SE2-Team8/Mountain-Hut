import crypto from "crypto";
import request from "supertest";
import { expect, vi } from "vitest";
import app from "../../index.js";
import { PWD_HASH_LEN, SALT_LEN } from "../../repositories/userRepository.js";
import { dateToStringISO } from "../../utils/dateTimeFormatter.js";
import { queryAll, queryGet, queryRun } from "../../utils/query.js";


export const USERS = {
	warden: { password: "strong_password", role: "WARDEN", fullName: "Mario Rossi", email: "mario.rossi@gmail.com", phoneNumber: "+39 1234567890", notes: null, emergencyContact: null },
	employee: { password: "weak_password", role: "EMPLOYEE", fullName: "Luigi Rossi", email: "luigi.rossi@libero.it", phoneNumber: "+39 2345678901", notes: null, emergencyContact: null },
	hiker: { password: "iLoveHuts", role: "HIKER", fullName: "Paola Bianchi", email: "funnyhiker.82@gmail.com", phoneNumber: "+39 9876543210", notes: "registered mountain guide", emergencyContact: "+39 8765432109" },
	hiker2: { password: "libellula", role: "HIKER", fullName: "Giovanni Muciaccia", email: "gio.ilMucia@gmail.com", phoneNumber: "+39 1212121212", notes: null, emergencyContact: "+39 9876543210" },
};

const TABLE_LIST_1 = [6, 4, 6, 6, 4, 8]; 
const TABLE_LIST_2 = [4, 4, 4, 6, 6, 6]; 

export const SLOTS = [
	{ start: Date.UTC(2027, 2, 10, 12, 30), end: Date.UTC(2027, 2, 10, 14, 30), tables: TABLE_LIST_1 },
	{ start: Date.UTC(2027, 2, 10, 18, 30), end: Date.UTC(2027, 2, 10, 19, 30), tables: TABLE_LIST_2 },
	{ start: Date.UTC(2027, 2, 10, 19, 30), end: Date.UTC(2027, 2, 10, 21, 0), tables: TABLE_LIST_2 },
	{ start: Date.UTC(2027, 2, 11, 12, 0), end: Date.UTC(2027, 2, 11, 14, 0), tables: [] },
].map((s) => ({
	...s,
	startISO: dateToStringISO(new Date(s.start)),
	endISO: dateToStringISO(new Date(s.end)),
	totalSeats: s.tables.reduce((a, b) => a + b, 0),
}));


let hashedUsers = null;
function getHashedUsers() {
	if (!hashedUsers) {
		hashedUsers = Object.values(USERS).map((user) => {
			const salt = crypto.randomBytes(SALT_LEN).toString("hex");
			return { ...user, salt, hash: crypto.scryptSync(user.password, salt, PWD_HASH_LEN).toString("hex") };
		});
	}
	return hashedUsers;
}

function assertTestDatabase() {
	if (process.env.DB_CONNECTION !== ":memory:")
		throw new Error(
			`Refusing to reset the database: DB_CONNECTION is "${process.env.DB_CONNECTION}", expected ":memory:". ` +
			`Run the tests with vitest (see vitest.config.js).`
		);
}

export const initSchema = async () => {
	assertTestDatabase();
	await queryRun(`DROP TABLE IF EXISTS tableAssignments`);
	await queryRun(`DROP TABLE IF EXISTS tables`);
	await queryRun(`DROP TABLE IF EXISTS reservations`);
	await queryRun(`DROP TABLE IF EXISTS timeSlots`);
	await queryRun(`DROP TABLE IF EXISTS users`);

	await queryRun(`CREATE TABLE users (
		userId INTEGER PRIMARY KEY AUTOINCREMENT,
		passwordHash TEXT NOT NULL,
		passwordSalt TEXT NOT NULL,
		role TEXT NOT NULL CHECK (role IN ('HIKER', 'EMPLOYEE', 'WARDEN')),
		fullName TEXT NOT NULL,
		email TEXT UNIQUE NOT NULL,
		phoneNumber TEXT NOT NULL,
		notes TEXT,
		emergencyContact TEXT
	)`);

	await queryRun(`CREATE TABLE timeSlots (
		timeSlotId INTEGER PRIMARY KEY AUTOINCREMENT,
		startDateTime TEXT UNIQUE NOT NULL,
		endDateTime TEXT NOT NULL
	)`);

	await queryRun(`CREATE TABLE reservations (
		reservId INTEGER PRIMARY KEY AUTOINCREMENT,
		userId INTEGER NOT NULL,
		timeSlotId INTEGER NOT NULL,
		partySize INTEGER NOT NULL,
		FOREIGN KEY (userId) REFERENCES users(userId),
		FOREIGN KEY (timeSlotId) REFERENCES timeSlots(timeSlotId)
	)`);

	await queryRun(`CREATE TABLE tables (
		tableId INTEGER PRIMARY KEY AUTOINCREMENT,
		tableNumber INTEGER NOT NULL,
		totalSeats INTEGER NOT NULL DEFAULT 0,
		freeSeats INTEGER NOT NULL DEFAULT 0,
		timeSlotId INTEGER NOT NULL,
		FOREIGN KEY (timeSlotId) REFERENCES timeSlots(timeSlotId),
		UNIQUE (timeSlotId, tableNumber)
	)`);

	await queryRun(`CREATE TABLE tableAssignments (
		tableId INTEGER NOT NULL,
		reservId INTEGER NOT NULL,
		occupiedSeats INTEGER NOT NULL,
		PRIMARY KEY (tableId, reservId),
		FOREIGN KEY (tableId) REFERENCES tables(tableId),
		FOREIGN KEY (reservId) REFERENCES reservations(reservId)
	)`);
};

export const clear_db = async () => {
	assertTestDatabase();
	await queryRun(`DELETE FROM tableAssignments`);
	await queryRun(`DELETE FROM tables`);
	await queryRun(`DELETE FROM timeSlots`);
	await queryRun(`DELETE FROM reservations`);
	await queryRun(`DELETE FROM users`);
	await queryRun(`DELETE FROM sqlite_sequence`);
};

export const seed_db = async () => {
	for (const u of getHashedUsers()) {
		await queryRun(
			`INSERT INTO users (passwordHash, passwordSalt, role, fullName, email, phoneNumber, notes, emergencyContact)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[u.hash, u.salt, u.role, u.fullName, u.email, u.phoneNumber, u.notes, u.emergencyContact]
		);
	}

	for (const slot of SLOTS) {
		const { lastID: timeSlotId } = await queryRun(
			`INSERT INTO timeSlots (startDateTime, endDateTime) VALUES (?, ?)`,
			[slot.startISO, slot.endISO]
		);
		for (const [index, seats] of slot.tables.entries()) {
			await queryRun(
				`INSERT INTO tables (tableNumber, totalSeats, freeSeats, timeSlotId) VALUES (?, ?, ?, ?)`,
				[index + 1, seats, seats, timeSlotId]
			);
		}
	}
};

export const resetDb = async () => {
	await clear_db();
	await seed_db();
};


export async function loginAs(email, password) {
	const agent = request.agent(app);
	const res = await agent.post("/api/sessions").send({ username: email, password });
	if (res.status !== 200)
		throw new Error(`Login failed for ${email}: ${res.status}`);
	return agent;
}

export const loginAsRole = (role) => loginAs(USERS[role].email, USERS[role].password);


export async function getUserId(email) {
	const row = await queryGet("SELECT userId FROM users WHERE email = ?", [email]);
	return row?.userId;
}

export async function getTimeSlotId(startISO) {
	const row = await queryGet("SELECT timeSlotId FROM timeSlots WHERE startDateTime = ?", [startISO]);
	return row?.timeSlotId;
}

export const getTables = (timeSlotId) =>
	queryAll("SELECT * FROM tables WHERE timeSlotId = ? ORDER BY tableNumber", [timeSlotId]);

export const getFreeSeats = async (timeSlotId) =>
	(await queryGet("SELECT COALESCE(SUM(freeSeats), 0) AS seats FROM tables WHERE timeSlotId = ?", [timeSlotId])).seats;

export const getReservations = () => queryAll("SELECT * FROM reservations ORDER BY reservId");

export const getAssignments = (reservId) =>
	queryAll(
		`SELECT ta.tableId, ta.occupiedSeats, t.tableNumber, t.totalSeats
		FROM tableAssignments ta JOIN tables t ON t.tableId = ta.tableId
		WHERE ta.reservId = ? ORDER BY ta.occupiedSeats DESC, t.tableNumber`,
		[reservId]
	);

export const getSeatLedger = (timeSlotId) =>
	queryAll(
		`SELECT t.tableId, t.tableNumber, t.totalSeats, t.freeSeats,
		COALESCE(SUM(ta.occupiedSeats), 0) AS assigned
		FROM tables t LEFT JOIN tableAssignments ta ON ta.tableId = t.tableId
		WHERE t.timeSlotId = ? GROUP BY t.tableId ORDER BY t.tableNumber`,
		[timeSlotId]
	);

export async function expectSeatsConsistent(timeSlotId) {
	for (const table of await getSeatLedger(timeSlotId)) {
		expect(table.freeSeats, `table ${table.tableNumber} free seats`).toBeGreaterThanOrEqual(0);
		expect(table.totalSeats - table.freeSeats, `table ${table.tableNumber} taken seats`).toBe(table.assigned);
	}
}

export function freezeTime(isoOrMs) {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(typeof isoOrMs === "number" ? isoOrMs : new Date(isoOrMs));
}

export const muteConsoleError = () => vi.spyOn(console, "error").mockImplementation(() => {});

export function expectEnvelope(res, success) {
	expect(res.body).toHaveProperty("success", success);
	expect(res.body).toHaveProperty("data");
	expect(res.body).toHaveProperty("message", expect.any(String));
}
