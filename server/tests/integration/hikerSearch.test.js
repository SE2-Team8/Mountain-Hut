import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../index.js";
import db from "../../config/db";
import { queryGet } from "../../utils/query";
import { initSchema, resetDb, loginAsRole, getUserId, muteConsoleError, expectEnvelope, USERS } from "../helpers/helpers.js";

// the seeded users
const { warden, employee, hiker, hiker2 } = USERS;

const search = (agent, value) => agent.get("/api/users/search").query(value === undefined ? {} : { value });
const names = (res) => res.body.data.map((u) => u.fullName);

beforeAll(initSchema);
beforeEach(async () => {
    muteConsoleError();
    await resetDb();
});
afterAll(() => db.close());

describe("GET /api/users/search - who can search", () => {
    it.each([["an employee", "employee"], ["a warden", "warden"]])("200 for %s", async (_label, role) => {
		const res = await search(await loginAsRole(role), "bianchi");

		expect(res.status).toBe(200);
		expectEnvelope(res, true);
	});

    it("403 for a hiker", async () => {
		const res = await search(await loginAsRole("hiker"), "bianchi");

		expect(res.status).toBe(403);
		expectEnvelope(res, false);
	});

    it("401 without a session", async () => {
		const res = await search(request(app), "bianchi");

		expect(res.status).toBe(401);
		expectEnvelope(res, false);
	});
});

describe("GET /api/users/search - what is found", () => {
    it("finds a hiker by a part of the full name, ignoring upper and lower case", async () => {
		const res = await search(await loginAsRole("employee"), "BIANCH");

		expect(res.status).toBe(200);
		expect(names(res)).toEqual([hiker.fullName]);
	});

    it("finds a hiker by a part of the email", async () => {
		const res = await search(await loginAsRole("employee"), "ilmucia@");

		expect(names(res)).toEqual([hiker2.fullName]);
	});

    it("finds a hiker by the whole email", async () => {
		const res = await search(await loginAsRole("employee"), hiker.email);

		expect(names(res)).toEqual([hiker.fullName]);
	});

    it("finds a hiker by a part of the phone number, written as it is stored", async () => {
		const res = await search(await loginAsRole("employee"), "987654");

		expect(names(res)).toEqual([hiker.fullName]);
	});

    it("returns the whole profile of each hiker found", async () => {
		const res = await search(await loginAsRole("employee"), "bianchi");

		expect(res.body.data).toEqual([{
			userId: await getUserId(hiker.email),
			role: "HIKER",
			fullName: hiker.fullName,
			email: hiker.email,
			phoneNumber: hiker.phoneNumber,
			notes: hiker.notes,
			emergencyContact: hiker.emergencyContact,
			mustChangePassword: false,
		}]);
	});

    it("returns all the matching hikers, sorted by full name", async () => {
		// "gmail" is in the email of both hikers (and of the warden, who must not be returned)
		const res = await search(await loginAsRole("employee"), "gmail");

		expect(names(res)).toEqual([hiker2.fullName, hiker.fullName].sort());
	});

    it("never returns staff users, even when their name matches", async () => {
		// "Rossi" is the surname of both the warden and the employee
		const res = await search(await loginAsRole("employee"), "rossi");

		expect(res.status).toBe(200);
		expect(res.body.data).toEqual([]);
	});

    it("never returns staff users when searching by their email", async () => {
		const res = await search(await loginAsRole("warden"), employee.email);

		expect(res.body.data).toEqual([]);
	});

    it("200 with an empty list when nobody matches", async () => {
		const res = await search(await loginAsRole("employee"), "nobody-has-this-name");

		expect(res.status).toBe(200);
		expectEnvelope(res, true);
		expect(res.body.data).toEqual([]);
	});

    it("finds a hiker who registered right now", async () => {
		await request(app).post("/api/auth/register").send({
			email: "new.hiker@example.com", password: "s3cret!", fullName: "Nuovo Escursionista",
			phone: "+39 333 1112222", notes: null, emergencyContact: null,
		}).expect(201);

		const res = await search(await loginAsRole("employee"), "escursionista");

		expect(names(res)).toEqual(["Nuovo Escursionista"]);
	});

    it("ignores the spaces around the searched value", async () => {
		const res = await search(await loginAsRole("employee"), "   bianchi   ");

		expect(names(res)).toEqual([hiker.fullName]);
	});

    it("never exposes the password hash or the salt", async () => {
		const res = await search(await loginAsRole("employee"), "gmail");
		const row = await queryGet("SELECT passwordHash, passwordSalt FROM users WHERE email = ?", [hiker.email]);

		for (const user of res.body.data) {
			expect(user).not.toHaveProperty("passwordHash");
			expect(user).not.toHaveProperty("passwordSalt");
		}
		expect(JSON.stringify(res.body)).not.toContain(row.passwordHash);
	});

    it("a value that looks like sql is just text: nobody is found and the users are untouched", async () => {
		const res = await search(await loginAsRole("employee"), "x' OR 1=1; DROP TABLE users; --");

		expect(res.status).toBe(200);
		expect(res.body.data).toEqual([]);
		expect((await queryGet("SELECT COUNT(*) AS n FROM users")).n).toBe(Object.keys(USERS).length);
	});
});

describe("GET /api/users/search - input validation", () => {
    it.each([
		["value is missing", undefined],
		["value is empty", ""],
		["value is only spaces", "    "],
	])("422 when %s", async (_label, value) => {
		const res = await search(await loginAsRole("employee"), value);

		expect(res.status).toBe(422);
		expectEnvelope(res, false);
	});

    it("422 when value is given twice (it becomes a list, not a text)", async () => {
		const res = await (await loginAsRole("employee")).get("/api/users/search?value=paola&value=giovanni");

		expect(res.status).toBe(422);
		expectEnvelope(res, false);
	});

    it("the search route is not taken as a user id", async () => {
		const res = await search(await loginAsRole("employee"), "bianchi");

		expect(res.status).not.toBe(404);
		expect(Array.isArray(res.body.data)).toBe(true);
	});
})


