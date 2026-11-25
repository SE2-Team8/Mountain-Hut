import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import request from "supertest";

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail}) } }));

import app from "../../index.js";
import db from "../../config/db.js";
import { getAvailableTables } from "../../repositories/reservationRepository.js";
import { formatDateTime } from "../../utils/dateTimeFormatter.js";
import {
	initSchema, resetDb, loginAsRole, getUserId, getTimeSlotId, getReservations, getAssignments, getFreeSeats,
	expectSeatsConsistent, freezeTime, muteConsoleError, expectEnvelope, USERS, SLOTS,
	HIKER_USER_2,
} from "../helpers/helpers.js";

const [S1, S2, , S4, S5] = SLOTS;
const NOW = "2027-03-01T12:00:00Z";
const HOUR = 3600e3;

let slot1, slot2, slot4, slot5;

const requirement = (description, allergies) => ({ description, allergies });

// creates a reservation through the API and returns its id
async function book(agent, { timeSlotId = slot1, partySize = 4, dietaryRequirements = [] } = {}) {
	const res = await agent.post("/api/reservations").send({ timeSlotId, partySize, dietaryRequirements });
	expect(res.status, "the booking used to prepare the test must succeed").toBe(201);
	return res.body.data;
}

const get = (agent, reservId) => agent.get(`/api/reservations/${reservId}`);

// update body, with fields to override
const updateBody = (overrides = {}) => ({
    timeSlotId: slot1,
    partySize: 4,
    dietaryRequirements: [],
    ...overrides,
});
const update = (agent, reservId, overrides = {}) => agent.put(`/api/reservations/${reservId}`).send(updateBody(overrides));

const takenSeats = async (reservId) => (await getAssignments(reservId)).reduce((sum, a) => sum + a.occupiedSeats, 0);
const storedRequirements = (row) => JSON.parse(row.dietaryRequirements);

// everithing that must stay as it was when an update is refused
async function snapshot(reservId) {
    return {
        reservations: await getReservations(),
        assignments: await getAssignments(reservId),
        freeSeats1: await getFreeSeats(slot1),
        freeSeats2: await getFreeSeats(slot2),
        freeSeats5: await getFreeSeats(slot5),
    };
}

async function expectUnchanged(reservId, before) {
    expect(await snapshot(reservId)).toEqual(before);
    await expectSeatsConsistent(slot1);
    await expectSeatsConsistent(slot2);
    expect(sendMail).not.toHaveBeenCalled();
}

beforeAll(initSchema);
beforeEach(async () => {
    muteConsoleError();
    await resetDb();
    sendMail.mockResolvedValue({ messageId: "test-id", accepted: [], rejected: [] });
    freezeTime(NOW);
    slot1 = await getTimeSlotId(S1.startISO);
    slot2 = await getTimeSlotId(S2.startISO);
    slot4 = await getTimeSlotId(S4.startISO);
    slot5 = await getTimeSlotId(S5.startISO);
});
afterEach(() => vi.useRealTimers());
afterAll(() => db.close());

describe("GET /api/reservations/:id", () => {
    it("200 with the reservation, its time slot already resolved and its requirements", async () => {
		const agent = await loginAsRole("hiker");
		const requirements = [requirement("1 peanut allergy", true), requirement("2 vegetarians", false)];
		const reservId = await book(agent, { partySize: 5, dietaryRequirements: requirements });

		const res = await get(agent, reservId);

		expect(res.status).toBe(200);
		expectEnvelope(res, true);
		expect(res.body.data).toMatchObject({
			reservId,
			timeSlotId: slot1,
			partySize: 5,
			dietaryRequirements: requirements,
		});
		expect(Date.parse(res.body.data.startDateTime)).toBe(S1.start);
		expect(Date.parse(res.body.data.endDateTime)).toBe(S1.end);
	});

    // not in US6, but agreed by the team: the endpoint returns the table assignments too
	it("includes the table assignments of the reservation", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { partySize: 9 });

		const res = await get(agent, reservId);

		expect(res.status).toBe(200);
		const assignments = res.body.data.tableAssignments;
		expect(Array.isArray(assignments)).toBe(true);
		expect(assignments.reduce((sum, a) => sum + a.occupiedSeats, 0)).toBe(9);
		for (const a of assignments) {
			expect(a).toHaveProperty("tableNumber");
			expect(a).toHaveProperty("occupiedSeats");
		}
	});

    it("shows the new data after an update", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent);
		await update(agent, reservId, { timeSlotId: slot2, partySize: 6, dietaryRequirements: [requirement("1 vegan", false)] }).expect(200);

		const res = await get(agent, reservId);

		expect(res.body.data).toMatchObject({ reservId, timeSlotId: slot2, partySize: 6, dietaryRequirements: [requirement("1 vegan", false)] });
		expect(Date.parse(res.body.data.startDateTime)).toBe(S2.start);
	});

    it("401 without a session", async () => {
		const reservId = await book(await loginAsRole("hiker"));

		const res = await get(request(app), reservId);

		expect(res.status).toBe(401);
		expectEnvelope(res, false);
	});

    it("403 for the reservation of another user, and none of its data is returned", async () => {
		const reservId = await book(await loginAsRole("hiker"), { dietaryRequirements: [requirement("secret allergy", true)] });

		const res = await get(await loginAsRole("hiker2"), reservId);

		expect(res.status).toBe(403);
		expectEnvelope(res, false);
		expect(JSON.stringify(res.body)).not.toContain("secret allergy");
	});

    it("404 for a reservation that does not exist", async () => {
		const res = await get(await loginAsRole("hiker"), 9999);

		expect(res.status).toBe(404);
		expectEnvelope(res, false);
	});

    it.each([
		["a text", "abc"],
		["zero", "0"],
		["a negative number", "-3"],
		["a decimal number", "1.5"],
	])("422 when the id is %s", async (_label, id) => {
		const res = await get(await loginAsRole("hiker"), id);

		expect(res.status).toBe(422);
		expectEnvelope(res, false);
	});
});

describe("PUT /api/reservations/:id - success", () => {
    it("200, and the new time slot, party size and requirements are stored", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent);
		const requirements = [requirement("1 milk allergy", true)];

		const res = await update(agent, reservId, { timeSlotId: slot2, partySize: 6, dietaryRequirements: requirements });

		expect(res.status).toBe(200);
		expectEnvelope(res, true);
		const [row] = await getReservations();
		expect(row).toMatchObject({ reservId, userId: await getUserId(HIKER_USER_1.email), timeSlotId: slot2, partySize: 6 });
		expect(storedRequirements(row)).toEqual(requirements);
	});

    it("only the requirements change: the tables stay exactly the same", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { partySize: 5 });
		const tablesBefore = await getAssignments(reservId);

		const res = await update(agent, reservId, { partySize: 5, dietaryRequirements: [requirement("2 vegans", false)] });

		expect(res.status).toBe(200);
		expect(await getAssignments(reservId)).toEqual(tablesBefore);
		expect(await getFreeSeats(slot1)).toBe(S1.totalSeats - 5);
		expect(storedRequirements((await getReservations())[0])).toEqual([requirement("2 vegans", false)]);
	});

    it("bigger party: exactly the new number of seats is taken and seats stay consistent", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { partySize: 4 });

		const res = await update(agent, reservId, { partySize: 9 });

		expect(res.status).toBe(200);
		expect(await getFreeSeats(slot1)).toBe(S1.totalSeats - 9);
		expect(await takenSeats(reservId)).toBe(9);
		await expectSeatsConsistent(slot1);
	});

    it("smaller party: the seats that are not needed anymore are released", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { partySize: 10 });

		const res = await update(agent, reservId, { partySize: 2 });

		expect(res.status).toBe(200);
		expect(await getFreeSeats(slot1)).toBe(S1.totalSeats - 2);
		expect(await takenSeats(reservId)).toBe(2);
		await expectSeatsConsistent(slot1);
	});

    // clarifications: a new party size is treated as a new booking, with the MH-01 rules
	it("the tables are assigned again as for a new booking of the new party size", async () => {
		const agent = await loginAsRole("hiker");
		const expected = await getAvailableTables(slot1, 9); // what a new booking of 9 would get in the empty slot
		const reservId = await book(agent, { partySize: 4 });

		await update(agent, reservId, { partySize: 9 }).expect(200);

		const assigned = (await getAssignments(reservId)).map((a) => ({ tableId: a.tableId, seats: a.occupiedSeats }));
		const fresh = expected.map((t) => ({ tableId: t.tableId, seats: t.seatsToTake }));
		const byTable = (a, b) => a.tableId - b.tableId;
		expect(assigned.sort(byTable)).toEqual(fresh.sort(byTable));
	});

    it("the seats of the reservation itself count as free: the party can grow up to the whole slot", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { partySize: 4 });

		const res = await update(agent, reservId, { partySize: S1.totalSeats });

		expect(res.status).toBe(200);
		expect(await getFreeSeats(slot1)).toBe(0);
		await expectSeatsConsistent(slot1);
	});

    it("other slot: the old seats are all released and the new ones are taken", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { partySize: 4 });

		const res = await update(agent, reservId, { timeSlotId: slot2, partySize: 4 });

		expect(res.status).toBe(200);
		expect(await getFreeSeats(slot1)).toBe(S1.totalSeats);
		expect(await getFreeSeats(slot2)).toBe(S2.totalSeats - 4);
		expect(await takenSeats(reservId)).toBe(4);
		await expectSeatsConsistent(slot1);
		await expectSeatsConsistent(slot2);
	});

    it("the reservations of the other users are not touched", async () => {
		const other = await book(await loginAsRole("hiker2"), { partySize: 6 });
		const otherTables = await getAssignments(other);
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { partySize: 4 });

		await update(agent, reservId, { partySize: 10 }).expect(200);

		expect(await getAssignments(other)).toEqual(otherTables);
		expect(await getFreeSeats(slot1)).toBe(S1.totalSeats - 6 - 10);
		await expectSeatsConsistent(slot1);
	});

    it("the public slot endpoints show the new free seats of both slots", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { partySize: 4 });

		await update(agent, reservId, { timeSlotId: slot2, partySize: 5 }).expect(200);

		expect((await request(app).get(`/api/timeslots/${S1.startISO}`)).body.data.freeSeats).toBe(S1.totalSeats);
		expect((await request(app).get(`/api/timeslots/${S2.startISO}`)).body.data.freeSeats).toBe(S2.totalSeats - 5);
	});

    it("the same reservation can be changed more than once", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { partySize: 4 });

		await update(agent, reservId, { timeSlotId: slot2, partySize: 6 }).expect(200);
		await update(agent, reservId, { timeSlotId: slot1, partySize: 3 }).expect(200);

		expect(await getFreeSeats(slot1)).toBe(S1.totalSeats - 3);
		expect(await getFreeSeats(slot2)).toBe(S2.totalSeats);
		expect(await getReservations()).toHaveLength(1);
		await expectSeatsConsistent(slot1);
		await expectSeatsConsistent(slot2);
	});
});

describe("PUT /api/reservations/:id - refused changes leave the booking as it was", () => {
    it("400 when the bigger party does not fit, and nothing changes", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { partySize: 4, dietaryRequirements: [requirement("1 vegan", false)] });
		sendMail.mockClear();
		const before = await snapshot(reservId);

		const res = await update(agent, reservId, { partySize: S1.totalSeats + 1 });

		expect(res.status).toBe(400);
		expectEnvelope(res, false);
		await expectUnchanged(reservId, before);
	});

    it("400 when the other slot does not have enough seats, and nothing changes in either slot", async () => {
		await book(await loginAsRole("hiker2"), { timeSlotId: slot2, partySize: S2.totalSeats - 3 });
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { partySize: 4 });
		sendMail.mockClear();
		const before = await snapshot(reservId);

		const res = await update(agent, reservId, { timeSlotId: slot2, partySize: 4 });

		expect(res.status).toBe(400);
		await expectUnchanged(reservId, before);
	});

    it("400 when moving to a slot without any table", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { partySize: 2 });
		sendMail.mockClear();
		const before = await snapshot(reservId);

		const res = await update(agent, reservId, { timeSlotId: slot4, partySize: 2 });

		expect(res.status).toBe(400);
		await expectUnchanged(reservId, before);
	});

    it("409 when the user already has another reservation in the new slot, and nothing changes", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { partySize: 4 });
		await book(agent, { timeSlotId: slot2, partySize: 2 });
		sendMail.mockClear();
		const before = await snapshot(reservId);

		const res = await update(agent, reservId, { timeSlotId: slot2, partySize: 4 });

		expect(res.status).toBe(409);
		expectEnvelope(res, false);
		await expectUnchanged(reservId, before);
	});

    it("a reservation of another user in the new slot is not a conflict", async () => {
		await book(await loginAsRole("hiker2"), { timeSlotId: slot2, partySize: 2 });
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { partySize: 4 });

		expect((await update(agent, reservId, { timeSlotId: slot2, partySize: 4 })).status).toBe(200);
	});

    it("401 without a session, and nothing changes", async () => {
		const reservId = await book(await loginAsRole("hiker"));
		sendMail.mockClear();
		const before = await snapshot(reservId);

		const res = await update(request(app), reservId, { partySize: 2 });

		expect(res.status).toBe(401);
		expectEnvelope(res, false);
		await expectUnchanged(reservId, before);
	});

    it("403 when changing the reservation of another user, and nothing changes", async () => {
		const reservId = await book(await loginAsRole("hiker"));
		sendMail.mockClear();
		const before = await snapshot(reservId);

		const res = await update(await loginAsRole("hiker2"), reservId, { partySize: 2 });

		expect(res.status).toBe(403);
		expectEnvelope(res, false);
		await expectUnchanged(reservId, before);
	});

    it("404 for a reservation that does not exist", async () => {
		const res = await update(await loginAsRole("hiker"), 9999);

		expect(res.status).toBe(404);
		expectEnvelope(res, false);
		expect(sendMail).not.toHaveBeenCalled();
	});

    it("404 for a time slot that does not exist, and nothing changes", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent);
		sendMail.mockClear();
		const before = await snapshot(reservId);

		const res = await update(agent, reservId, { timeSlotId: 9999 });

		expect(res.status).toBe(404);
		await expectUnchanged(reservId, before);
	});
});

describe("PUT /api/reservations/:id - input validation", () => {
    it.each([
		["the id is a text", "abc", {}],
		["the id is zero", "0", {}],
		["timeSlotId is a text", null, { timeSlotId: "abc" }],
		["partySize is zero", null, { partySize: 0 }],
		["partySize is a text", null, { partySize: "many" }],
		["dietaryRequirements is not an array", null, { dietaryRequirements: "vegan" }],
		["a requirement is a text", null, { dietaryRequirements: ["vegan"] }],
		["a requirement has no allergies field", null, { dietaryRequirements: [{ description: "vegan" }] }],
		["allergies of a requirement is not a boolean", null, { dietaryRequirements: [requirement("vegan", "maybe")] }],
		["a requirement has no description", null, { dietaryRequirements: [{ allergies: true }] }],
		["description of a requirement is empty", null, { dietaryRequirements: [requirement("", false)] }],
		["description of a requirement is only spaces", null, { dietaryRequirements: [requirement("   ", true)] }],
	])("422 when %s, and nothing changes", async (_label, badId, overrides) => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent);
		sendMail.mockClear();
		const before = await snapshot(reservId);

		const res = await update(agent, badId ?? reservId, overrides);

		expect(res.status).toBe(422);
		expectEnvelope(res, false);
		await expectUnchanged(reservId, before);
	});

    it.each([
		["timeSlotId is missing", "timeSlotId"],
		["partySize is missing", "partySize"],
		["dietaryRequirements is missing", "dietaryRequirements"],
	])("400 when %s: the body must have exactly 3 fields, and nothing changes", async (_label, missing) => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent);
		sendMail.mockClear();
		const before = await snapshot(reservId);
		const body = updateBody();
		delete body[missing];

		const res = await agent.put(`/api/reservations/${reservId}`).send(body);

		expect(res.status).toBe(400);
		expectEnvelope(res, false);
		await expectUnchanged(reservId, before);
	});

    it("400 when the body has an extra field, and nothing changes", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent);
		sendMail.mockClear();
		const before = await snapshot(reservId);

		const res = await update(agent, reservId, { userId: await getUserId(HIKER_USER_2.email) });

		expect(res.status).toBe(400);
		await expectUnchanged(reservId, before);
	});
});

describe("PUT /api/reservations/:id - time limits", () => {
    it("the new slot must start at least 2 hours later: accepted exactly 2 hours before", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { timeSlotId: slot5, partySize: 2 });
		freezeTime(S1.start - 2 * HOUR);

		expect((await update(agent, reservId, { timeSlotId: slot1, partySize: 2 })).status).toBe(200);
	});

    it("the new slot must start at least 2 hours later: refused 1 second after the limit, and nothing changes", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { timeSlotId: slot5, partySize: 2 });
		sendMail.mockClear();
		const before = { ...(await snapshot(reservId)), freeSeats5: await getFreeSeats(slot5) };
		freezeTime(S1.start - 2 * HOUR + 1000);

		const res = await update(agent, reservId, { timeSlotId: slot1, partySize: 2 });

		expect(res.status).toBe(400);
		expectEnvelope(res, false);
        expect({ ...(await snapshot(reservId)), freeSeats5: await getFreeSeats(slot5) }).toEqual(before);
        await expectSeatsConsistent(slot5);
		await expectUnchanged(reservId, before);
	});

    it("refused when the new slot has already started", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { timeSlotId: slot5, partySize: 2 });
		freezeTime(S2.start + 60e3);

		expect((await update(agent, reservId, { timeSlotId: slot2, partySize: 3 })).status).toBe(400);
	});

    // US6 notes: "Changes are admitted within 48 hours from the date booked".
	it("48 hours rule: a change is accepted 49 hours before the booked slot", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { partySize: 2 });
		freezeTime(S1.start - 49 * HOUR);

		expect((await update(agent, reservId, { partySize: 3 })).status).toBe(200);
	});

    it("48 hours rule: a change is refused 47 hours before the booked slot, and nothing changes", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { partySize: 2 });
		sendMail.mockClear();
		const before = await snapshot(reservId);
		freezeTime(S1.start - 47 * HOUR);

		const res = await update(agent, reservId, { partySize: 3 });

		expect(res.status).toBe(400);
		expectEnvelope(res, false);
		await expectUnchanged(reservId, before);
	});

    it("48 hours rule: a booking close to its slot cannot be moved to a later slot either", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { partySize: 2 });
		freezeTime(S1.start - 47 * HOUR);

		expect((await update(agent, reservId, { timeSlotId: slot2, partySize: 2 })).status).toBe(400);
	});

    it("48 hours rule: a booking whose slot starts in less than 2 hours cannot be moved to a later slot", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { partySize: 2 });
		sendMail.mockClear();
		freezeTime(S1.start - 1 * HOUR);

		const res = await update(agent, reservId, { timeSlotId: slot5, partySize: 2 });

		expect(res.status).toBe(400);
		expect((await getReservations())[0].timeSlotId).toBe(slot1);
		expect(sendMail).not.toHaveBeenCalled();
	});

    it("48 hours rule: a booking whose slot is already over cannot be moved to a later slot", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { partySize: 2 });
		sendMail.mockClear();
		freezeTime(S1.end + 1 * HOUR);

		const res = await update(agent, reservId, { timeSlotId: slot5, partySize: 2 });

		expect(res.status).toBe(400);
		expect((await getReservations())[0].timeSlotId).toBe(slot1);
		expect(sendMail).not.toHaveBeenCalled();
	});
});

describe("GET /api/reservations - all the reservations of the logged user", () => {
    it("200 with only the reservations of the logged user, with their requirements", async () => {
		const agent = await loginAsRole("hiker");
		const first = await book(agent, { partySize: 3, dietaryRequirements: [requirement("1 vegan", false)] });
		const second = await book(agent, { timeSlotId: slot2, partySize: 5 });
		const others = await book(await loginAsRole("hiker2"), { partySize: 2 });

		const res = await agent.get("/api/reservations");

		expect(res.status).toBe(200);
		expectEnvelope(res, true);
		const byId = Object.fromEntries(res.body.data.map((r) => [r.reservId, r]));
		expect(Object.keys(byId).map(Number).sort()).toEqual([first, second].sort());
		expect(byId[others]).toBeUndefined();
		expect(byId[first]).toMatchObject({ timeSlotId: slot1, partySize: 3, dietaryRequirements: [requirement("1 vegan", false)] });
		expect(byId[second]).toMatchObject({ timeSlotId: slot2, partySize: 5, dietaryRequirements: [] });
	});

    it("shows the new data of a reservation after an update", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { partySize: 3 });
		await update(agent, reservId, { timeSlotId: slot2, partySize: 6 }).expect(200);

		const res = await agent.get("/api/reservations");

		expect(res.body.data).toHaveLength(1);
		expect(res.body.data[0]).toMatchObject({ reservId, timeSlotId: slot2, partySize: 6 });
	});

    // a user without reservations is not an error: the list is simply empty
	it("200 with an empty list when the user has no reservations", async () => {
		await book(await loginAsRole("hiker"));

		const res = await (await loginAsRole("hiker2")).get("/api/reservations");

		expect(res.status).toBe(200);
		expectEnvelope(res, true);
		expect(res.body.data).toEqual([]);
	});

    it("401 without a session", async () => {
		await book(await loginAsRole("hiker"));

		const res = await request(app).get("/api/reservations");

		expect(res.status).toBe(401);
		expectEnvelope(res, false);
	});
})

describe("PUT /api/reservations/:id - email notification", () => {
    const sentMail = () => sendMail.mock.calls[0][0];

    it("sends one email with the new data of the reservation", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { partySize: 4 });
		sendMail.mockClear();

		await update(agent, reservId, {
			timeSlotId: slot2,
			partySize: 6,
			dietaryRequirements: [requirement("1 allergic to peanuts", true), requirement("1 vegan", false)],
		}).expect(200);

		expect(sendMail).toHaveBeenCalledTimes(1);
		expect(sentMail()).toMatchObject({ to: HIKER_USER_1.email, subject: "Reservation Updated" });
		const html = sentMail().html;
		expect(html).toContain(HIKER_USER_1.fullName);
		expect(html).toContain(`<strong>Reservation number:</strong> ${reservId}`);
		expect(html).toContain("<strong>Party size:</strong> 6");
		expect(html).toContain("<strong>Allergies:</strong> Yes");
		expect(html).toContain("1 allergic to peanuts (Allergy), 1 vegan (Diet)");
		expect(html).toContain(formatDateTime(new Date(S2.start)));
		expect(html).toContain(formatDateTime(new Date(S2.end)));
	});

    it("an email is sent also when only the requirements change", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { partySize: 4 });
		sendMail.mockClear();

		await update(agent, reservId, { partySize: 4, dietaryRequirements: [requirement("2 vegetarians", false)] }).expect(200);

		expect(sendMail).toHaveBeenCalledTimes(1);
		expect(sentMail().html).toContain("<strong>Allergies:</strong> No");
		expect(sentMail().html).toContain("2 vegetarians (Diet)");
	});

    it("says 'None' when all the requirements are removed", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent, { dietaryRequirements: [requirement("1 vegan", false)] });
		sendMail.mockClear();

		await update(agent, reservId, { dietaryRequirements: [] }).expect(200);

		expect(sentMail().html).toContain("<strong>Dietary Requirements:</strong> None");
	});

    it("escapes the html written in a requirement", async () => {
		const agent = await loginAsRole("hiker");
		const reservId = await book(agent);
		sendMail.mockClear();

		await update(agent, reservId, { dietaryRequirements: [requirement("<script>alert(1)</script>", true)] }).expect(200);

		expect(sentMail().html).not.toContain("<script>alert(1)</script>");
		expect(sentMail().html).toContain("&lt;script&gt;");
	});
});