import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../index.js";
import db from "../../config/db.js";
import { queryRun } from "../../utils/query.js";
import {
	initSchema, resetDb, loginAsRole, getTimeSlotId, getReservations, getAssignments, getFreeSeats, getTables, getSeatLedger,
	expectSeatsConsistent, freezeTime, muteConsoleError, expectEnvelope, SLOTS,
} from "../helpers/helpers.js";

const [S1, , , S4] = SLOTS;

let slot1, slot4;
const book = (agent, timeSlotId, partySize) => agent.post("/api/timeslots/reservation").send({ timeSlotId, partySize });

async function bookAndGetAssignments(role, timeSlotId, partySize) {
	const res = await book(await loginAsRole(role), timeSlotId, partySize);
	expect(res.status).toBe(201);
	return (await getAssignments(res.body.data)).map((a) => ({ tableSeats: a.totalSeats, occupiedSeats: a.occupiedSeats }));
}

beforeAll(initSchema);
beforeEach(async () => {
	muteConsoleError();
	await resetDb();
	freezeTime("2027-03-09T12:30:00Z");
	slot1 = await getTimeSlotId(S1.startISO);
	slot4 = await getTimeSlotId(S4.startISO);
});
afterEach(() => vi.useRealTimers());
afterAll(() => db.close());

describe("seat allocation", () => {
	it.each([
		[1, [{ tableSeats: 4, occupiedSeats: 1 }]],  
		[5, [{ tableSeats: 6, occupiedSeats: 5 }]],   
		[9, [{ tableSeats: 8, occupiedSeats: 8 }, { tableSeats: 4, occupiedSeats: 1 }]],  
	])("a party of %i gets the right tables", async (partySize, expectedAssignments) => {
		const assignments = await bookAndGetAssignments("hiker", slot1, partySize);

		expect(assignments).toEqual(expectedAssignments);
		expect(await getFreeSeats(slot1)).toBe(S1.totalSeats - partySize);
		await expectSeatsConsistent(slot1);
	});

	it("a table that is partially taken is reused by the next booking before opening a new one", async () => {
		await bookAndGetAssignments("hiker", slot1, 2); 
		const [second] = await bookAndGetAssignments("hiker2", slot1, 2);

		expect(second).toEqual({ tableSeats: 4, occupiedSeats: 2 });
		const fullTables = (await getTables(slot1)).filter((t) => t.freeSeats === 0);
		expect(fullTables).toHaveLength(1);
		expect(await getFreeSeats(slot1)).toBe(S1.totalSeats - 4);
		await expectSeatsConsistent(slot1);
	});

	it("a booking is refused when the free seats of the slot are not enough, leaving everything untouched", async () => {
		await bookAndGetAssignments("hiker", slot1, 30);
		const res = await book(await loginAsRole("hiker2"), slot1, 5); 
		expect(res.status).toBeGreaterThanOrEqual(400);
		expectEnvelope(res, false);
		expect(res.body.message).toMatch(/not enough free seats/i);
		expect(await getReservations()).toHaveLength(1);
		expect(await getFreeSeats(slot1)).toBe(4);
		await expectSeatsConsistent(slot1);
	});

	it("a party bigger than the free seats is answered with a 4xx, not a 500", async () => {
		const res = await book(await loginAsRole("hiker"), slot1, S1.totalSeats + 1);
		expect(res.status).toBeGreaterThanOrEqual(400);
		expect(res.status).toBeLessThan(500);
	});
});
