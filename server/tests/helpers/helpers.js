import request from "supertest";
import { expect, Experimental, vi } from "vitest";
import app from "../../index.js";
import { hashPassword } from "../../repositories/userRepository.js";
import { dateToStringISO } from "../../utils/dateTimeFormatter.js";
import { queryAll, queryGet, queryRun } from "../../utils/query.js";
import { createDBTables, deleteDBData } from "../../database/migration.js";

export const WARDEN_USER = {
	userId: 1,
	role: "WARDEN",
	password: process.env.SEED_USER_PWD,
	fullName: "Mario Rossi",
	email: "mario.rossi@gmail.com", phoneNumber: "+39 1234567890",
	notes: null, emergencyContact: null
};
export const EMPLOYEE_USER = { 
	userId: 2, 
	role: "EMPLOYEE",
	password: process.env.SEED_USER_PWD,
	fullName: "Luigi Rossi",
	email: "luigi.rossi@libero.it", phoneNumber: "+39 2345678901",
	notes: null, emergencyContact: null 
};
export const HIKER_USER_1 = { 
	userId: 3, 
	role: "HIKER", 
	password: process.env.SEED_USER_PWD, 
	fullName: "Paola Bianchi",
	email: "funnyhiker.82@gmail.com", phoneNumber: "+39 9876543210",
	notes: "registered mountain guide",
	emergencyContact: "+39 8765432109" 
};
export const HIKER_USER_2 = { 
	userId: 4, 
	role: "HIKER",
	password: process.env.SEED_USER_PWD, 
	fullName: "Giovanni Muciaccia",
	email: "gio.ilMucia@gmail.com", phoneNumber: "+39 1212121212", 
	notes: null, emergencyContact: "+39 9876543210"
};

export const USERS = [
	WARDEN_USER,
	EMPLOYEE_USER,
	HIKER_USER_1,
	HIKER_USER_2
];

export const USERS_BY_ROLE = { 
	warden: WARDEN_USER, 
	employee: EMPLOYEE_USER, 
	hiker: HIKER_USER_1, 
	hiker2: HIKER_USER_2 
};

export const GET_USER_BY_ID_MOCKED = (userId) => Object.assign({}, USERS[userId - 1]);

const TABLE_LIST_1 = [6, 4, 6, 6, 4, 8]; 
const TABLE_LIST_2 = [4, 4, 4, 6, 6, 6]; 
const TABLE_LIST_3 = [4, 6, 8];

export const SLOTS = [
	{ start: Date.UTC(2027, 2, 10, 12, 30), end: Date.UTC(2027, 2, 10, 14, 30), tables: TABLE_LIST_1 },
	{ start: Date.UTC(2027, 2, 10, 18, 30), end: Date.UTC(2027, 2, 10, 19, 30), tables: TABLE_LIST_2 },
	{ start: Date.UTC(2027, 2, 10, 19, 30), end: Date.UTC(2027, 2, 10, 21, 0), tables: TABLE_LIST_2 },
	{ start: Date.UTC(2027, 2, 11, 12, 0), end: Date.UTC(2027, 2, 11, 14, 0), tables: [] },
	{ start: Date.UTC(2027, 2, 12, 12, 0), end: Date.UTC(2027, 2, 12, 14, 0), tables: TABLE_LIST_3 },
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
			const { salt, hash } = hashPassword(user.password);
			return { ...user, salt, hash };
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
	await createDBTables();
};

export const clear_db = async () => {
	assertTestDatabase();
	await deleteDBData();
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
	const res = await agent.post("/api/auth/login").send({ username: email, password });
	if (res.status !== 200)
		throw new Error(`Login failed for ${email}: ${res.status}`);
	return agent;
}

export const loginAsRole = (role) => loginAs(USERS_BY_ROLE[role].email, USERS_BY_ROLE[role].password);


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

export async function countTimeSlots (){
	const amount = await queryGet("SELECT COUNT(*) as cnt FROM TIMESLOTS")
	return amount.cnt;
}

export async function countTables (){
	const amount = await queryGet("SELECT COUNT(*) as cnt FROM TABLES ")
	return amount.cnt;
}

export async function noTimeSlotAdded () {
	expect(await countTimeSlots()).toEqual(SLOTS.length);
	const expectedTables = SLOTS.reduce((sum, s) => sum + s.tables.length, 0);
	expect(await countTables()).toEqual(expectedTables);
}

export function UTCToISOString(year = 0, month = 0, day =0, hour = 0, minutes = 0, seconds = 0, ms = 0) {
	return dateToStringISO(new Date( Date.UTC(year, month, day, hour, minutes, seconds, ms) ))
}

export async function getTablesByTimeSlotId (id) {
	const tables = queryAll("SELECT tableNumber from tables where timeSlotId = ?", [id])
	return tables
 }