import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../index.js";
import db from "../../config/db.js";
import { clear_db, initSchema, resetDb, expectEnvelope, SLOTS } from "../helpers/helpers.js";

const [S1, S2, S3, S4] = SLOTS;

beforeAll(initSchema);
beforeEach(resetDb);
afterAll(() => db.close());

const expected = (slot, timeSlotId) => ({
	timeSlotId,
	startDateTime: new Date(slot.start).toISOString(),
	endDateTime: new Date(slot.end).toISOString(),
	freeSeats: slot.totalSeats,
});
const startsOf = (res) => res.body.data.map((s) => s.startDateTime);
const iso = (slot) => new Date(slot.start).toISOString();

describe("GET /api/timeslots", () => {
	it("200 and every slot with the free seats summed over its tables (no login needed)", async () => {
		const res = await request(app).get("/api/timeslots");

		expect(res.status).toBe(200);
		expectEnvelope(res, true);
		expect(res.body.data).toEqual([expected(S1, 1), expected(S2, 2), expected(S3, 3), expected(S4, 4)]);
		expect(res.body.data.map((s) => s.freeSeats)).toEqual([34, 30, 30, 0]);
	});

	it("200 and an empty list when there are no slots", async () => {
		await clear_db();
		const res = await request(app).get("/api/timeslots");

		expect(res.status).toBe(200);
		expect(res.body.data).toEqual([]);
	});

	describe("filters", () => {
		it("from: slots starting at or after it (bound included)", async () => {
			const res = await request(app).get("/api/timeslots").query({ from: S2.startISO });

			expect(startsOf(res)).toEqual([iso(S2), iso(S3), iso(S4)]);
		});

		it("to: slots starting at or before it (bound included)", async () => {
			const res = await request(app).get("/api/timeslots").query({ to: S2.startISO });

			expect(startsOf(res)).toEqual([iso(S1), iso(S2)]);
		});

		it("from + to: a range with both bounds included", async () => {
			const res = await request(app).get("/api/timeslots").query({ from: S2.startISO, to: S3.startISO });

			expect(startsOf(res)).toEqual([iso(S2), iso(S3)]);
		});

		it("200 and an empty list when no slot is in the range", async () => {
			const res = await request(app).get("/api/timeslots").query({ from: "2030-01-01T00:00:00Z" });

			expect(res.status).toBe(200);
			expect(res.body.data).toEqual([]);
		});

		it.each(["from"])("422 when %s is not a valid ISO 8601 date", async (param) => {
			const res = await request(app).get("/api/timeslots").query({ [param]: "yesterday" });

			expect(res.status).toBe(422);
			expectEnvelope(res, false);
			expect(res.body.data.map((e) => e.path)).toContain(param);
		});
	});
});

describe("GET /api/timeslots/:start", () => {
	it.each([
		["a slot with tables", S1, 1],
		["a slot without tables (0 free seats)", S4, 4],
	])("200 and the slot, for %s (no login needed)", async (_label, slot, id) => {
		const res = await request(app).get(`/api/timeslots/${slot.startISO}`);

		expect(res.status).toBe(200);
		expectEnvelope(res, true);
		expect(res.body.data).toEqual(expected(slot, id));
	});

	it("accepts the same instant written with a time zone offset", async () => {
		// 13:30+01:00 is 12:30Z
		const res = await request(app).get(`/api/timeslots/${encodeURIComponent("2027-03-10T13:30:00+01:00")}`);

		expect(res.status).toBe(200);
		expect(res.body.data.startDateTime).toBe(iso(S1));
	});

	it("404 when no slot starts at that instant", async () => {
		const res = await request(app).get("/api/timeslots/2027-03-10T12:31:00Z");

		expect(res.status).toBe(404);
		expectEnvelope(res, false);
		expect(res.body.data).toBeNull();
	});

	it.each(["not-a-date"])("422 when the start is %j", async (start) => {
		const res = await request(app).get(`/api/timeslots/${start}`);

		expect(res.status).toBe(422);
		expectEnvelope(res, false);
	});

});
