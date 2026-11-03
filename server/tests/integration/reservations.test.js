import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import request from "supertest";
const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail }) } }));
import app from "../../index.js";
import db from "../../config/db.js";
import { createHiker } from "../../repositories/userRepository.js";
import {
	initSchema, resetDb, loginAs, loginAsRole, getUserId, getTimeSlotId, getReservations, getAssignments, getFreeSeats,
	expectSeatsConsistent, freezeTime, muteConsoleError, expectEnvelope, USERS, SLOTS,
} from "../helpers/helpers.js";

const [S1, S2] = SLOTS;
const NOW = "2027-03-09T12:30:00Z";
const HOUR = 3600e3;

let slot1, slot2;
const book = (agent, timeSlotId, partySize) => agent.post("/api/timeslots/reservation").send({ timeSlotId, partySize });

beforeAll(initSchema);
beforeEach(async () => {
	muteConsoleError();
	await resetDb();
	sendMail.mockResolvedValue({ messageId: "test-id", accepted: [], rejected: [] });
	freezeTime(NOW);
	slot1 = await getTimeSlotId(S1.startISO);
	slot2 = await getTimeSlotId(S2.startISO);
});
afterEach(() => vi.useRealTimers());
afterAll(() => db.close());

async function expectNothingBooked() {
	expect(await getReservations()).toEqual([]);
	expect(await getFreeSeats(slot1)).toBe(S1.totalSeats);
}

describe("POST /api/timeslots/reservation - authentication", () => {
	it("401 without a session, and nothing is booked", async () => {
		const res = await book(request(app), slot1, 2);

		expect(res.status).toBe(401);
		expectEnvelope(res, false);
		await expectNothingBooked();
	});
});

describe("POST /api/timeslots/reservation - input validation", () => {
	it.each([
		["a timeSlotId that is not a number", { timeSlotId: "abc", partySize: 2 }],
		["a partySize of 0", { timeSlotId: 1, partySize: 0 }],
		["a partySize that is not a number", { timeSlotId: 1, partySize: "many" }],
	])("422 for %s", async (_label, body) => {
		const agent = await loginAsRole("hiker");
		const res = await agent.post("/api/timeslots/reservation").send(body);

		expect(res.status).toBe(422);
		expectEnvelope(res, false);
		await expectNothingBooked();
	});

	it.each([
		["an empty body", {}],
		["a missing partySize", { timeSlotId: 1 }],
	])("400 for %s: the body must have exactly 2 fields", async (_label, body) => {
		const agent = await loginAsRole("hiker");
		const res = await agent.post("/api/timeslots/reservation").send(body);

		expect(res.status).toBe(400);
		expectEnvelope(res, false);
		await expectNothingBooked();
	});

	it("nobody can book on behalf of another user: a userId in the body is refused", async () => {
		const agent = await loginAsRole("hiker");
		const otherUser = await getUserId(USERS.hiker2.email);
		const res = await agent.post("/api/timeslots/reservation").send({ timeSlotId: slot1, partySize: 2, userId: otherUser });

		expect(res.status).toBe(400);
		await expectNothingBooked();
	});

	it("404 when the time slot does not exist", async () => {
		const agent = await loginAsRole("hiker");
		const res = await book(agent, 9999, 2);

		expect(res.status).toBe(404);
		expectEnvelope(res, false);
		await expectNothingBooked();
	});
});

describe("POST /api/timeslots/reservation - success", () => {
	it("201 and the id of a reservation owned by the logged user", async () => {
		const agent = await loginAsRole("hiker");
		const res = await book(agent, slot1, 4);

		expect(res.status).toBe(201);
		expectEnvelope(res, true);
		expect(await getReservations()).toEqual([
			{ reservId: res.body.data, userId: await getUserId(USERS.hiker.email), timeSlotId: slot1, partySize: 4 },
		]);
	});

	it("takes exactly partySize seats and keeps seats and assignments consistent", async () => {
		const agent = await loginAsRole("hiker");
		const res = await book(agent, slot1, 5);

		expect(await getFreeSeats(slot1)).toBe(S1.totalSeats - 5);
		const assignments = await getAssignments(res.body.data);
		expect(assignments.reduce((sum, a) => sum + a.occupiedSeats, 0)).toBe(5);
		await expectSeatsConsistent(slot1);
	});

	it("the public slot endpoints show the new number of free seats", async () => {
		const agent = await loginAsRole("hiker");
		await book(agent, slot1, 5);

		const one = await request(app).get(`/api/timeslots/${S1.startISO}`);
		expect(one.body.data.freeSeats).toBe(S1.totalSeats - 5);
		const all = await request(app).get("/api/timeslots");
		expect(all.body.data.map((s) => s.freeSeats)).toEqual([S1.totalSeats - 5, S2.totalSeats, S2.totalSeats, 0]);
	});

	it("different users can book the same slot", async () => {
		await book(await loginAsRole("hiker"), slot1, 3).then((r) => expect(r.status).toBe(201));
		await book(await loginAsRole("hiker2"), slot1, 4).then((r) => expect(r.status).toBe(201));

		expect(await getFreeSeats(slot1)).toBe(S1.totalSeats - 7);
		expect(await getReservations()).toHaveLength(2);
		await expectSeatsConsistent(slot1);
	});

	it("the same user can book different slots", async () => {
		const agent = await loginAsRole("hiker");

		expect((await book(agent, slot1, 2)).status).toBe(201);
		expect((await book(agent, slot2, 2)).status).toBe(201);
	});

	it("a party as big as all the free seats of the slot fits", async () => {
		const res = await book(await loginAsRole("hiker"), slot1, S1.totalSeats);

		expect(res.status).toBe(201);
		expect(await getFreeSeats(slot1)).toBe(0);
		await expectSeatsConsistent(slot1);
	});

	// After registration, the session stores just the id, so req.user.usrId is undefined 
	it("a user can book right after registering (the automatic login works)", async () => {
		const agent = request.agent(app);
		await agent.post("/api/register").send({
			email: "new.hiker@example.com", password: "s3cret!", fullName: "New Hiker",
			phone: "+39 333 1112222", notes: "n", emergencyContact: "e",
		}).expect(201);

		const res = await book(agent, slot1, 2);
		expect(res.status).toBe(201);
	});
});

describe("POST /api/timeslots/reservation - one reservation per user per slot", () => {
	it("409 on the second booking of the same slot, and nothing else changes", async () => {
		const agent = await loginAsRole("hiker");
		await book(agent, slot1, 2).expect(201);
		const res = await book(agent, slot1, 3);
		expect(res.status).toBe(409);
		expectEnvelope(res, false);
		expect(await getReservations()).toHaveLength(1);
		expect(await getFreeSeats(slot1)).toBe(S1.totalSeats - 2);
	});
});

describe("POST /api/timeslots/reservation - 2 hours rule", () => {
	const START = Date.parse(S1.startISO);
	const at = (msBeforeStart) => freezeTime(START - msBeforeStart);

	it("accepted exactly 2 hours before the start", async () => {
		const agent = await loginAsRole("hiker");
		at(2 * HOUR);

		expect((await book(agent, slot1, 2)).status).toBe(201);
	});

	it("refused 1 second after the 2-hours limit, and nothing is booked", async () => {
		const agent = await loginAsRole("hiker");
		at(2 * HOUR - 1000);

		const res = await book(agent, slot1, 2);

		expect(res.status).toBe(400);
		expectEnvelope(res, false);
		expect(res.body.message).toMatch(/2 hours/);
		await expectNothingBooked();
	});

	it("refused when the slot has already started", async () => {
		const agent = await loginAsRole("hiker");
		at(-60e3);

		expect((await book(agent, slot1, 2)).status).toBe(400);
		await expectNothingBooked();
	});
});