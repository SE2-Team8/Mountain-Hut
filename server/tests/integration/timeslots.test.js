import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../index.js";
import db from "../../config/db.js";
import { clear_db, initSchema, resetDb, expectEnvelope, SLOTS, loginAs, loginAsRole, noTimeSlotAdded, freezeTime, UTCToISOString, getTimeSlotId, getTablesByTimeSlotId } from "../helpers/helpers.js";
import { dateToStringISO } from "../../utils/dateTimeFormatter.js";

const [S1, S2, S3, S4] = SLOTS;
const NOW = "2027-03-09T12:30:00Z";

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

describe("POST /api/timeslots - authentication", ()=>{ 

		it("a hiker can't insert a new timeslot", async ()=>{
			const agent = await loginAsRole("hiker");
			const res = await agent.post('/api/timeslots').send({
				startDateTime : UTCToISOString(2027, 10, 10, 12, 30),
				endDateTime : UTCToISOString(2027, 10, 13, 12, 30),
				copyFromTimeSlotId : 1
				}	
			)
 			expect(res.status).toBe(403);
			expectEnvelope(res, false)
			await noTimeSlotAdded();

		})

		it("a user can't insert a new timeslot", async ()=>{
			const res = await request(app).post('/api/timeslots').send({
				startDateTime : UTCToISOString(2027, 10, 10, 12, 30),
				endDateTime : UTCToISOString(2027, 10, 13, 12, 30),
				copyFromTimeSlotId : 1
				}	
			)
 			expect(res.status).toBe(401);
			expectEnvelope(res, false)
			await noTimeSlotAdded();

		})

})

describe("POST /api/timeslots - invalid data", ()=>{ 
	it("400 if too few body parameters", async()=>{
	const agent = await loginAsRole("employee");
			const res = await agent.post('/api/timeslots').send({
				startDateTime : UTCToISOString(2027, 10, 10, 12, 30),
				endDateTime : UTCToISOString(2027, 10, 13, 12, 30),
				}	
			)
 			expect(res.status).toBe(400);
			expectEnvelope(res, false)
			await noTimeSlotAdded();	
	})
	it("400 if too many body parameters", async()=>{
	const agent = await loginAsRole("employee");
			const res = await agent.post('/api/timeslots').send({
				startDateTime : UTCToISOString(2027, 10, 10, 12, 30),
				endDateTime : UTCToISOString(2027, 10, 13, 12, 30),
				fakePar : 0,
				copyFromTimeSlotId : 1
				}	
			)
 			expect(res.status).toBe(400);
			expectEnvelope(res, false)
			await noTimeSlotAdded();	
	})

	it("400 if both options are chosen", async()=>{
	const agent = await loginAsRole("employee");
			const res = await agent.post('/api/timeslots').send({
				startDateTime : UTCToISOString(2027, 10, 10, 12, 30),
				endDateTime : UTCToISOString(2027, 10, 13, 12, 30),
				tables : [{tableNumber: 1, totalSeats: 6}],
				copyFromTimeSlotId : 1
				}	
			)
 			expect(res.status).toBe(400);
			expectEnvelope(res, false)
			await noTimeSlotAdded();	
	})

	describe("invalid dates", ()=>{ 
		
		it.each([
			["first date is null, second is valid", [null,UTCToISOString(2027, 10, 10, 12, 30)]],
			["first date is valid, second is null", [UTCToISOString(2027, 10, 10, 12, 30), null]],
			["first date comes after the second one", [UTCToISOString(2027, 10, 15, 12, 30),UTCToISOString(2027, 10, 10, 12, 30)]],
			["all dates are null", [null,null]],
			["both dates are in the past", [UTCToISOString(2025, 10, 15, 12, 30),UTCToISOString(2025, 10, 16, 12, 30)]],
			["first date is in the past",[UTCToISOString(2025, 10, 15, 12, 30),UTCToISOString(2027, 3, 9, 12, 30, 0, 1)]],
			["dates are not ISO strings",["today","tomorrow"]]])
			("4xx if %s", async(_label,body) =>{
				const agent = await loginAsRole("employee")
				const res = await agent.post('/api/timeslots').send({
				startDateTime : body[0],
				endDateTime : body[1],
				copyFromTimeSlotId: 1,
				}	
			)
			await noTimeSlotAdded();	
			expectEnvelope(res, false)
			expect(res.status).toBeGreaterThanOrEqual(400);
			expect(res.status).toBeLessThan(500);
			})
		
	})
	describe("invalid tables", ()=>{ 
		
		it.each([
			["seats is not a number", [{tableNumber : 1, totalSeats: "four"}]],
			["table is not a number", [{tableNumber : "one", totalSeats : 6}]],
			["table is an empty array", []]])
			("4xx if %s", async(_label,body) =>{
				const agent = await loginAsRole("employee")
				const res = await agent.post('/api/timeslots').send({
				startDateTime : UTCToISOString(2027, 10, 15, 12, 30),
				endDateTime : UTCToISOString(2027, 10, 15, 13, 30),
				tables : body
				}	
			)
			await noTimeSlotAdded();	
			expectEnvelope(res, false)
			expect(res.status).toBeGreaterThanOrEqual(400);
			expect(res.status).toBeLessThan(500);
			})
		
	})	

	describe ("invalid timeSlots", () => {
		it.each([
			["time slot to copy is not in the database", 999],
			["time slot id is not a number", "one"]
		])
		("4xx if %s", async(_label,body) =>{
			const agent = await loginAsRole("employee")
			const res = await agent.post('/api/timeslots').send({
			startDateTime : UTCToISOString(2027, 10, 15, 12, 30),
			endDateTime : UTCToISOString(2027, 10, 15, 13, 30),
			copyFromTimeSlotId : body,	
		})
			await noTimeSlotAdded();	
			expectEnvelope(res, false)
			expect(res.status).toBeGreaterThanOrEqual(400);
			expect(res.status).toBeLessThan(500);
			})
	})

	it("409 if timeslot already exists", async()=>{
	const agent = await loginAsRole("employee");
			const res = await agent.post('/api/timeslots').send({
				startDateTime : dateToStringISO(new Date (S1.start)),
				endDateTime : dateToStringISO(new Date (S1.end)),
				copyFromTimeSlotId : 1
				}	
			)
 			expect(res.status).toBe(409);
			expectEnvelope(res, false)
			await noTimeSlotAdded();	
	})

})

describe("POST /api/timeslots - overlaps", () => {
	it.each([
		["starts before, ends inside (partial left)", UTCToISOString(2027, 2, 10, 11, 30), UTCToISOString(2027, 2, 10, 13, 30)],
		["starts inside, ends after (partial right)", UTCToISOString(2027, 2, 10, 13, 30), UTCToISOString(2027, 2, 10, 15, 30)],
		["completely inside (enclosed)", UTCToISOString(2027, 2, 10, 13, 0), UTCToISOString(2027, 2, 10, 14, 0)],
		["completely encloses the new slot (enclosing)", UTCToISOString(2027, 2, 10, 11, 30), UTCToISOString(2027, 2, 10, 15, 30)]
	])("409 if %s", async (_label, startDateTime, endDateTime) => {
		const agent = await loginAsRole("employee");
		const res = await agent.post('/api/timeslots').send({
			startDateTime,
			endDateTime,
			copyFromTimeSlotId: 1
		});
		
		expect(res.status).toBe(409);
		expectEnvelope(res, false);
		expect(res.body.message).toMatch(/overlap/i);
		
		await noTimeSlotAdded();
	});
});

describe("POST /api/timeslots - happy paths", ()=>{
	it("happy path for option A", async ()=>{
		const agent = await loginAsRole("employee")
		const res = await agent.post('/api/timeslots').send({
			startDateTime : UTCToISOString(2027, 10, 15, 12, 30),
			endDateTime : UTCToISOString(2027, 10, 15, 13, 30),
			tables: [{tableNumber : 5, totalSeats : 4}],	
		})
		const timeSlotId = await getTimeSlotId(UTCToISOString(2027, 10, 15, 12, 30))
		expect(timeSlotId).not.toBeNull()
		const tables = await getTablesByTimeSlotId(timeSlotId);
		expect(tables).toContainEqual({tableNumber: 5})
		expectEnvelope(res, true)
		expect(res.status).toBe(201)
		expect(res.body.data.timeSlotId).toEqual(timeSlotId)
	})
	it("happy path for option B", async ()=>{
		const agent = await loginAsRole("employee")
		const res = await agent.post('/api/timeslots').send({
			startDateTime : UTCToISOString(2027, 10, 15, 12, 30),
			endDateTime : UTCToISOString(2027, 10, 15, 13, 30),
			copyFromTimeSlotId: 1,	
		})
		const timeSlotId = await getTimeSlotId(UTCToISOString(2027, 10, 15, 12, 30))
		expect(timeSlotId).not.toBeNull()
		const newTables = await getTablesByTimeSlotId(timeSlotId);
		const oldTables = await getTablesByTimeSlotId(1)
		expect(newTables).toEqual(oldTables)
		expectEnvelope(res, true)
		expect(res.status).toBe(201)
		expect(res.body.data.timeSlotId).toEqual(timeSlotId)
	})
})
