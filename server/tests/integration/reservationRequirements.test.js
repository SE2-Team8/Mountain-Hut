import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import request from "supertest";
import { createTransport } from "nodemailer";

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail }) } }));

import app from "../../index.js";
import db from "../../config/db.js";
import {
	initSchema, resetDb, loginAsRole, getTimeSlotId, getReservations, getFreeSeats,
	expectSeatsConsistent, freezeTime, muteConsoleError, expectEnvelope, SLOTS, getUserId, HIKER_USER_1
} from "../helpers/helpers.js";

const [S1] = SLOTS;
const NOW = "2027-03-09T12:30:00Z";

let slot1;

// valid booking body, with fields to override
const bodyOf = (overrides = {}) => ({
    timeSlotId: slot1,
    partySize: 4,
    dietaryRequirements: [],
    ...overrides,
});
async function book(agent, overrides = {}) {
	const meRes = await agent.get("/api/auth/me");
	const userId = meRes.status === 401 ? await getUserId(HIKER_USER_1.email) : meRes.body.data.userId;
	return agent.post("/api/reservations").send(bodyOf({ userId, ...overrides }));
}

// one requirement as the client send it
const requirement = (description, allergies) => ({ description, allergies });

// the list of requirements stored for a reservation
const storedRequirements = (row) => JSON.parse(row.dietaryRequirements);

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
        const requirements = [requirement("1 peanut allergy", true), requirement("2 vegetarians", false)];
        const res = await book(agent, { dietaryRequirements: requirements });

        expect(res.status).toBe(201);
        expectEnvelope(res, true);
        const [row] = await getReservations();
		expect(row.reservId).toBe(res.body.data);
		expect(storedRequirements(row)).toEqual(requirements);
    });

    // the booking page sends one item for each line written in its two sections
    it("allergy items and dietary items sent together are all stored", async () => {
		const requirements = [
			requirement("1 allergic to peanuts", true),
			requirement("1 allergic to milk", true),
			requirement("1 vegetarian", false),
			requirement("1 vegan", false),
		];
		const res = await book(await loginAsRole("hiker"), { partySize: 4, dietaryRequirements: requirements });

		expect(res.status).toBe(201);
		const [row] = await getReservations();
		expect(storedRequirements(row)).toEqual(requirements);
	});

    it("201 with no requirements: an empty list is stored", async () => {
		const res = await book(await loginAsRole("hiker"));

		expect(res.status).toBe(201);
		const [row] = await getReservations();
		expect(storedRequirements(row)).toEqual([]);
	});

    // user story 5, third example of the clarifications: "allergies: no, 2 vegetarians"
    it("requirements without allergies are stored too (e.g. '2 vegetarians')", async () => {
		const requirements = [requirement("2 vegetarians", false)];
		const res = await book(await loginAsRole("hiker"), { dietaryRequirements: requirements });

		expect(res.status).toBe(201);
		const [row] = await getReservations();
		expect(storedRequirements(row)).toEqual(requirements);
	});

    it("the requirements of different bookings are kept separate", async () => {
		await book(await loginAsRole("hiker"), { partySize: 2, dietaryRequirements: [requirement("peanut allergy", true)] });
		await book(await loginAsRole("hiker2"), { partySize: 3, dietaryRequirements: [requirement("3 vegans", false)] });

		const rows = await getReservations();
		expect(rows).toHaveLength(2);
		expect(storedRequirements(rows[0])).toEqual([requirement("peanut allergy", true)]);
		expect(storedRequirements(rows[1])).toEqual([requirement("3 vegans", false)]);
	});
});

describe("POST /api/reservations - requirements: input validation", () => {
    it.each([
		["dietaryRequirements is a text", { dietaryRequirements: "vegan" }],
		["dietaryRequirements is a object", { dietaryRequirements: { description: "vegan", allergies: false } }],
		["a requirement is a text", { dietaryRequirements: "vegan" }],
		["a requirement is a number", { dietaryRequirements: [1] }],
		["a requirement is null", { dietaryRequirements: [null] }],
		["a requirement has no allergies field", { dietaryRequirements: [{ description: "vegan" }] }],
		["a requirement has no description", { dietaryRequirements: [{ allergies: false }] }],
		["allergies of a requirement is a text", { dietaryRequirements: [requirement("vegan", "maybe")] }],
		["allergies of a requirement is a number", { dietaryRequirements: [requirement("vegan", 5)] }],
		["allergies of a requirement is null", { dietaryRequirements: [requirement("vegan", null)] }],
		["description of a requirement is a number", { dietaryRequirements: [requirement(5, false)] }],
		["description of a requirement is null", { dietaryRequirements: [requirement(null, false)] }],
		["description of a requirement is an empty text", { dietaryRequirements: [requirement("", false)] }],
		["description of a requirement is only spaces", { dietaryRequirements: [requirement("   ", true)] }],
		["only one of two requirements is valid", { dietaryRequirements: [requirement("vegan", false), { description: "peanuts" }] }],
	])("422 when %s, and nothing is booked", async (_label, overrides) => {
		const res = await book(await loginAsRole("hiker"), overrides);

		expect(res.status).toBe(422);
		expectEnvelope(res, false);
		await expectNothingBooked();
	});

    it.each([
		["dietaryRequirements is missing", "dietaryRequirements"],
	])("422 when %s, and nothing is booked", async (_label, missing) => {
		const agent = await loginAsRole("hiker");
		const userId = (await agent.get("/api/auth/me")).body.data.userId;
		const body = bodyOf({ userId });
		delete body[missing];

		const res = await agent.post("/api/reservations").send(body);

		expect(res.status).toBe(422);
		expectEnvelope(res, false);
		await expectNothingBooked();
	});

    it("422 when the body has an unknown field, and nothing is booked", async () => {
		const res = await book(await loginAsRole("hiker"), { notes: "please be kind" });

		expect(res.status).toBe(422);
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
		const res = await book(request(app), { dietaryRequirements: [requirement("peanut allergy", true)] });

		expect(res.status).toBe(401);
		expectEnvelope(res, false);
		await expectNothingBooked();
	});

    it("404 for an unknown time slot: no requirements are stored", async () => {
		const res = await book(await loginAsRole("hiker"), { timeSlotId: 9999, dietaryRequirements: [requirement("peanut allergy", true)] });

		expect(res.status).toBe(404);
		await expectNothingBooked();
	});

    it("400 when there are not enough free seats: no requirements are stored", async () => {
		const res = await book(await loginAsRole("hiker"), { partySize: S1.totalSeats + 1, dietaryRequirements: [requirement("2 vegetarians", false)] });

		expect(res.status).toBe(400);
		await expectNothingBooked();
	});

    it("409 on the second booking of the same slot: the first requirements are kept untouched", async () => {
		const agent = await loginAsRole("hiker");
		await book(agent, { partySize: 2, dietaryRequirements: [requirement("peanut allergy", true)] });
		const res = await book(agent, { partySize: 2, dietaryRequirements: [requirement("2 vegans", false)] });

		expect(res.status).toBe(409);
		const rows = await getReservations();
		expect(rows).toHaveLength(1);
		expect(storedRequirements(rows[0])).toEqual([requirement("peanut allergy", true)]);
	});
});

describe("POST /api/reservations - requirements: confirmation email", () => {
    const sentHtml = () => sendMail.mock.calls[0][0].html;

    it("says 'Yes' to allergies and lists every requirement, marking allergies and diets", async () => {
		await book(await loginAsRole("hiker"), {
			dietaryRequirements: [requirement("1 allergic to peanuts", true), requirement("1 vegan", false)],
		});

		expect(sendMail).toHaveBeenCalledTimes(1);
		expect(sentHtml()).toContain("<strong>Allergies:</strong> Yes");
		expect(sentHtml()).toContain("1 allergic to peanuts (Allergy), 1 vegan (Diet)");
	});

    it("says 'No' to allergies and 'None' when there are no requirements", async () => {
		await book(await loginAsRole("hiker"));

		expect(sentHtml()).toContain("<strong>Allergies:</strong> No");
		expect(sentHtml()).toContain("<strong>Dietary Requirements:</strong> None");
	});

	it("says 'No' to allergies but lists the requirements when there are only diets", async () => {
		await book(await loginAsRole("hiker"), { dietaryRequirements: [requirement("2 vegetarians", false)] });

		expect(sentHtml()).toContain("<strong>Allergies:</strong> No");
		expect(sentHtml()).toContain("2 vegetarians (Diet)");
	});

	it("says 'Yes' to allergies when only one of the requirements is an allergy", async () => {
		await book(await loginAsRole("hiker"), {
			dietaryRequirements: [requirement("1 vegan", false), requirement("1 vegetarian", false), requirement("1 milk allergy", true)],
		});

		expect(sentHtml()).toContain("<strong>Allergies:</strong> Yes");
	});

    it("escapes the html written in a requirement", async () => {
		await book(await loginAsRole("hiker"), { dietaryRequirements: [requirement("<script>alert(1)</script>", true)] });

		expect(sentHtml()).not.toContain("<script>alert(1)</script>");
		expect(sentHtml()).toContain("&lt;script&gt;");
	});
});