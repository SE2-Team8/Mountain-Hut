import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import request from "supertest";
import { createTransport } from "nodemailer";

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail }) } }));

import app from "../../index.js";
import db from "../../config/db.js";
import {
	initSchema, resetDb, loginAsRole, getTimeSlotId, getReservations, getFreeSeats,
	expectSeatsConsistent, freezeTime, muteConsoleError, expectEnvelope, SLOTS,
} from "../helpers/helpers.js";

const [S1] = SLOTS;
const NOW = "2027-03-09T12:30:00Z";

let slot1;

// valid booking body, with fields to override
const bodyOf = (overrides = {}) => ({
    timeSlotId: slot1,
    partySize: 4,
    allergies: false,
    dietaryRequirements: [],
    ...overrides,
});
const book = (agent, overrides = {}) => agent.post("/api/reservations").send(bodyOf(overrides));

const storedRequirements = (row) => ({
    allergies: row.allergies,
    dietaryRequirements: JSON.parse(row.dietaryRequirements),
});

beforeAll(initSchema);
beforeEach(async () => {
    muteConsoleError();
    await resetDb();
    sendMail.mockResolvedValue({ messageId: "test-id", accepted: [], rejected: [] });
    freezeTime(NOW);
    slot1 = await getTimeSlotId(S1.startISO);
});
afterEach(() => vi.useRealTimers());
afterAll(() => db.close());

async function expectNothingBooked() {
    expect(await getReservations()).toEqual([]);
    expect(await getFreeSeats(slot1)).toBe(S1.totalSeats);
    await expectSeatsConsistent(slot1);
    expect(sendMail).not.toHaveBeenCalled();
}

describe("POST /api/reservations - requirement: success", () => {
    it("201 and the allergies flag and the list of requirements are stored, in the same order", async () => {
        const agent = await loginAsRole("hiker");
        const requirements = ["1 vegan, peanut allergy", "1 shellfish allergy"];
        const res = await book(agent, { allergies: true, dietaryRequirements: requirements });

        expect(res.status).toBe(201);
        expectEnvelope(res, true);
        const [row] = await getReservations();
		expect(row.reservId).toBe(res.body.data);
		expect(storedRequirements(row)).toEqual({ allergies: 1, dietaryRequirements: requirements });
    });

    // N.B: the booking page merges its two sections allergies and dietaryRestrictions into one list
    it("allergy items and dietary items sent together are all stored and listed in the email", async () => {
		const requirements = ["1 allergic to peanuts", "1 allergic to milk", "1 vegetarian", "1 vegan"];
		const res = await book(await loginAsRole("hiker"), { partySize: 4, allergies: true, dietaryRequirements: requirements });

		expect(res.status).toBe(201);
		const [row] = await getReservations();
		expect(storedRequirements(row)).toEqual({ allergies: 1, dietaryRequirements: requirements });
		expect(sendMail.mock.calls[0][0].html).toContain(requirements.join(", "));
	});

    it("201 with no allergies and no requirements: nothing special is stored", async () => {
		const res = await book(await loginAsRole("hiker"));

		expect(res.status).toBe(201);
		const [row] = await getReservations();
		expect(storedRequirements(row)).toEqual({ allergies: 0, dietaryRequirements: [] });
	});

    // user story 5, third example of the clarifications: "allergies: no, 2 vegetarians"
    it("requirements without allergies are stored too (e.g. '2 vegetarians')", async () => {
		const res = await book(await loginAsRole("hiker"), { allergies: false, dietaryRequirements: ["2 vegetarians"] });

		expect(res.status).toBe(201);
		const [row] = await getReservations();
		expect(storedRequirements(row)).toEqual({ allergies: 0, dietaryRequirements: ["2 vegetarians"] });
	});

    it("the requirements of different bookings are kept separate", async () => {
		await book(await loginAsRole("hiker"), { partySize: 2, allergies: true, dietaryRequirements: ["peanut allergy"] });
		await book(await loginAsRole("hiker2"), { partySize: 3, dietaryRequirements: ["3 vegans"] });

		const rows = await getReservations();
		expect(rows).toHaveLength(2);
		expect(storedRequirements(rows[0])).toEqual({ allergies: 1, dietaryRequirements: ["peanut allergy"] });
		expect(storedRequirements(rows[1])).toEqual({ allergies: 0, dietaryRequirements: ["3 vegans"] });
	});

    it("allergies sent as the string 'true' (the validator accepts it) is still stored as an allergy", async () => {
		const res = await book(await loginAsRole("hiker"), { allergies: "true", dietaryRequirements: ["peanut allergy"] });

		expect(res.status).toBe(201);
		const [row] = await getReservations();
		expect(storedRequirements(row)).toEqual({ allergies: 1, dietaryRequirements: ["peanut allergy"] });
	});
});

describe("POST /api/reservations - requirements: input validation", () => {
    it.each([
		["allergies is a text", { allergies: "maybe" }],
		["allergies is a number", { allergies: 5 }],
		["allergies is null", { allergies: null }],
		["dietaryRequirements is a text", { dietaryRequirements: "vegan" }],
		["dietaryRequirements is an object", { dietaryRequirements: { vegan: 2 } }],
		["a requirement is a number", { dietaryRequirements: [1] }],
		["a requirement is null", { dietaryRequirements: [null] }],
		["a requirement is an object", { dietaryRequirements: [{ description: "vegan" }] }],
		["a requirement is an empty text", { dietaryRequirements: [""] }],
		["a requirement is only spaces", { dietaryRequirements: ["   "] }],
		["there are allergies but no description of them", { allergies: true, dietaryRequirements: [] }],
	])("422 when %s, and nothing is booked", async (_label, overrides) => {
		const res = await book(await loginAsRole("hiker"), overrides);

		expect(res.status).toBe(422);
		expectEnvelope(res, false);
		await expectNothingBooked();
	});

    it.each([
		["allergies is missing", "allergies"],
		["dietaryRequirements is missing", "dietaryRequirements"],
	])("400 when %s: the body must have exactly 4 fields, and nothing is booked", async (_label, missing) => {
		const body = bodyOf();
		delete body[missing];
		const res = await (await loginAsRole("hiker")).post("/api/reservations").send(body);

		expect(res.status).toBe(400);
		expectEnvelope(res, false);
		await expectNothingBooked();
	});

    it("400 when the body has an unknown field, and nothing is booked", async () => {
		const res = await book(await loginAsRole("hiker"), { notes: "please be kind" });

		expect(res.status).toBe(400);
		expectEnvelope(res, false);
		await expectNothingBooked();
	});

    it("nobody can book on behalf of another user: a userId in the body is refused", async () => {
		const res = await book(await loginAsRole("hiker"), { userId: 2 });

		expect(res.status).toBe(400);
		await expectNothingBooked();
	});
});

describe("POST /api/reservations - requirements: other rules still apply", () => {
    it("401 without a session: no requirements are stored", async () => {
		const res = await book(request(app), { allergies: true, dietaryRequirements: ["peanut allergy"] });

		expect(res.status).toBe(401);
		expectEnvelope(res, false);
		await expectNothingBooked();
	});

    it("404 for an unknown time slot: no requirements are stored", async () => {
		const res = await book(await loginAsRole("hiker"), { timeSlotId: 9999, allergies: true, dietaryRequirements: ["peanut allergy"] });

		expect(res.status).toBe(404);
		await expectNothingBooked();
	});

    it("400 when there are not enough free seats: no requirements are stored", async () => {
		const res = await book(await loginAsRole("hiker"), { partySize: S1.totalSeats + 1, dietaryRequirements: ["2 vegetarians"] });

		expect(res.status).toBe(400);
		await expectNothingBooked();
	});

    it("409 on the second booking of the same slot: the first requirements are kept untouched", async () => {
		const agent = await loginAsRole("hiker");
		await book(agent, { partySize: 2, allergies: true, dietaryRequirements: ["peanut allergy"] });
		const res = await book(agent, { partySize: 2, allergies: false, dietaryRequirements: ["2 vegans"] });

		expect(res.status).toBe(409);
		const rows = await getReservations();
		expect(rows).toHaveLength(1);
		expect(storedRequirements(rows[0])).toEqual({ allergies: 1, dietaryRequirements: ["peanut allergy"] });
	});
});

describe("POST /api/reservations - requirements: confirmation email", () => {
    const sentHtml = () => sendMail.mock.calls[0][0].html;

    it("tells the hiker about the allergies and lists every requirement", async () => {
		await book(await loginAsRole("hiker"), { allergies: true, dietaryRequirements: ["1 vegan, peanut allergy", "1 shellfish allergy"] });

		expect(sendMail).toHaveBeenCalledTimes(1);
		expect(sentHtml()).toContain("<strong>Allergies:</strong> Yes");
		expect(sentHtml()).toContain("1 vegan, peanut allergy");
		expect(sentHtml()).toContain("1 shellfish allergy");
	});

    it("says that there are no allergies and no requirements when none were given", async () => {
		await book(await loginAsRole("hiker"));

		expect(sentHtml()).toContain("<strong>Allergies:</strong> No");
		expect(sentHtml()).toContain("<strong>Dietary Requirements:</strong> None");
	});

    it("lists the requirements given without allergies too", async () => {
		await book(await loginAsRole("hiker"), { allergies: false, dietaryRequirements: ["2 vegetarians"] });

		expect(sentHtml()).toContain("2 vegetarians");
	});

    it("escapes the html written in a requirement", async () => {
		await book(await loginAsRole("hiker"), { allergies: true, dietaryRequirements: ["<script>alert(1)</script>"] });

		expect(sentHtml()).not.toContain("<script>alert(1)</script>");
		expect(sentHtml()).toContain("&lt;script&gt;");
	});
})