import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../index.js";
import db from "../../config/db.js";
import { clear_db, initSchema, resetDb, expectEnvelope, SLOTS, loginAs, loginAsRole, noTimeSlotAdded, freezeTime, UTCToISOString, getTimeSlotId, getTablesByTimeSlotId } from "../helpers/helpers.js";
import { dateToStringISO } from "../../utils/dateTimeFormatter.js";

const [S1, S2, S3, S4] = SLOTS;
const NOW = "2027-03-09T12:30:00Z";
const FAR_IN_THE_FUTURE = "3027-03-09T12:30:00Z";


beforeAll(initSchema);
beforeEach(async () => {
	await resetDb();
	freezeTime(NOW)
});
afterAll(() => db.close());

const expected = (slot, timeSlotId) => ({
	timeSlotId,
	startDateTime: new Date(slot.start).toISOString(),
	endDateTime: new Date(slot.end).toISOString(),
	freeSeats: slot.totalSeats,
});
const startsOf = (res) => res.body.data.map((s) => s.startDateTime);
const iso = (slot) => new Date(slot.start).toISOString();


describe("GET /api/timeslots/availability", () => {
	// invalid input:
	it.each([
		{},
		{ start: NOW },
		{ partySize: 6 },
		{ start: "", partySize: "not_a_party_size" },
		{ start: "not_a_date", partySize: "not_a_party_size" },
		{ start: NOW, partySize: -1 },
		{ start: NOW, partySize: 0 },
		{ start: "not_a_date", partySize: 6 },
	])
	("422 when query parameters are missing or incorrect", async (queryParam) => {
		const res = await request(app).get("/api/timeslots/availability").query(queryParam);
		expect(res.status).toBe(422);
		expectEnvelope(res, false);
	});

	it("404 when timeslot is not found", async () => {
		const res = await request(app).get("/api/timeslots/availability").query({ start: FAR_IN_THE_FUTURE, partySize: 1 },);
		expect(res.status).toBe(404);
		expectEnvelope(res, false);
	});

	// correct configuration:
	it("200 and tables assigned seats equals party size", async () => {
		const slot = SLOTS[0];
		const totalSeats = slot.tables.reduce((total, seats) => total + seats);
		const expected = {
			available: true,
			freeSeats: totalSeats,
			tables: slot.tables.map((freeSeats, index) => {
				return {
					tableNumber: index + 1,
					seatsToTake: freeSeats
				};
			})
		};

		console.log(totalSeats)
		console.log(slot.startISO)
		console.log(expected, slot.startISO)
		const res = await request(app).get("/api/timeslots/availability")
		.query({ start: slot.startISO, partySize: totalSeats },);
		expect(res.status).toBe(200);
		expectEnvelope(res, true);
		expect(res.body.data).toEqual(expected);
	});

	it("200 and no tables assigned when checking for bigger party than free seats", async () => {
		const slot = SLOTS[0];
		const totalSeats = slot.tables.reduce((total, seats) => total + seats);
		const expected = {
			available: false,
			freeSeats: totalSeats,
			tables: []
		};

		console.log(totalSeats)
		console.log(slot.startISO)
		console.log(expected, slot.startISO)
		const res = await request(app).get("/api/timeslots/availability")
		.query({ start: slot.startISO, partySize: totalSeats + 1 },);
		expect(res.status).toBe(200);
		expectEnvelope(res, true);
		expect(res.body.data).toEqual(expected);
	});

	// TODO: check when not all seats are checked, that the correct selection strategy is applied
});
