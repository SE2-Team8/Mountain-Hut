import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../index.js";
import db from "../../config/db.js";
import { queryGet } from "../../utils/query.js";
import { initSchema, resetDb, muteConsoleError, expectEnvelope, USERS } from "../helpers/helpers.js";

beforeAll(initSchema);
beforeEach(async () => {
	muteConsoleError();
	await resetDb();
});
afterAll(() => db.close());

const NEW_USER = {
	email: "new.hiker@example.com",
	password: "s3cret!",
	fullName: "New Hiker",
	phone: "+39 333 1112222",
	notes: "vegetarian",
	emergencyContact: "+39 333 4445555",
};
const register = (body, agent = request(app)) => agent.post("/api/register").send(body);
const countUsers = async () => (await queryGet("SELECT COUNT(*) AS n FROM users")).n;

describe("POST /api/register - success", () => {
	it("201 and creates a HIKER with the given data", async () => {
		const res = await register(NEW_USER);

		expect(res.status).toBe(201);
		expectEnvelope(res, true);
		const row = await queryGet("SELECT * FROM users WHERE email = ?", [NEW_USER.email]);
		expect(row).toMatchObject({
			role: "HIKER",
			fullName: NEW_USER.fullName,
			phoneNumber: NEW_USER.phone, 
			notes: NEW_USER.notes,
			emergencyContact: NEW_USER.emergencyContact,
		});
	});

	it("stores a salted hash, never the password", async () => {
		await register(NEW_USER);
		const row = await queryGet("SELECT passwordHash, passwordSalt FROM users WHERE email = ?", [NEW_USER.email]);
		expect(row.passwordHash).not.toContain(NEW_USER.password);
		expect(row.passwordHash).toMatch(/^[0-9a-f]{128}$/);
		expect(row.passwordSalt).toMatch(/^[0-9a-f]{32}$/);
	});

	it("the new user can log in with the chosen credentials", async () => {
		await register(NEW_USER);
		const res = await request(app).post("/api/sessions").send({ username: NEW_USER.email, password: NEW_USER.password });
		expect(res.status).toBe(200);
		expect(res.body.data).toMatchObject({ email: NEW_USER.email, fullName: NEW_USER.fullName, role: "HIKER" });
	});

	it("a client cannot choose its own role (no privilege escalation)", async () => {
		const res = await register({ ...NEW_USER, emergencyContact: undefined, role: "WARDEN" });
		expect(res.status).toBe(201);
		expect((await queryGet("SELECT role FROM users WHERE email = ?", [NEW_USER.email])).role).toBe("HIKER");
	});

	it("the new user is logged in right after the registration", async () => {
		const agent = request.agent(app);
		await register(NEW_USER, agent).expect(201);

		expect((await agent.get("/api/sessions/current")).status).toBe(200);
	});

	//the user is not properly logged in after registration (right now the session only stores the id)
	it("the session of the new user holds the user profile, not just an id", async () => {
		const agent = request.agent(app);
		await register(NEW_USER, agent);
		const res = await agent.get("/api/sessions/current");
		expect(res.body.data).toMatchObject({ email: NEW_USER.email, fullName: NEW_USER.fullName, role: "HIKER" });
	});
});

describe("POST /api/register - validation", () => {
	it.each([
		["email", "not-an-email"],
		["password", 12345],
		["fullName", ""],
		["phone", ""],
	])("422 when %s is %j, and nothing is created", async (field, value) => {
		const res = await register({ ...NEW_USER, [field]: value });

		expect(res.status).toBe(422);
		expectEnvelope(res, false);
		expect(res.body.data.map((e) => e.path)).toContain(field);
		expect(await countUsers()).toBe(Object.keys(USERS).length);
	});

	it.each(["email", "phone"])("422 when %s is missing", async (field) => {
		const res = await register({ ...NEW_USER, [field]: undefined, unexpected: "x" });

		expect(res.status).toBe(422);
		expect(res.body.data.map((e) => e.path)).toContain(field);
	});

	it.each([
		["an empty body", {}],
		["an extra field", { ...NEW_USER, extra: "x" }],
	])("400 with %s: the body must have exactly 6 fields", async (_label, body) => {
		const res = await register(body);

		expect(res.status).toBe(400);
		expectEnvelope(res, false);
		expect(await countUsers()).toBe(Object.keys(USERS).length);
	});

});

describe("POST /api/register - duplicated email", () => {
	it("is refused, keeps the original account untouched and does not log the attacker in", async () => {
		const agent = request.agent(app);
		const res = await register({ ...NEW_USER, email: USERS.warden.email, password: "attacker-password" }, agent);

		expect(res.status).toBeGreaterThanOrEqual(400);
		expectEnvelope(res, false);
		expect(await countUsers()).toBe(Object.keys(USERS).length);
		expect((await agent.get("/api/sessions/current")).status).toBe(401);
		await request(app).post("/api/sessions").send({ username: USERS.warden.email, password: USERS.warden.password }).expect(200);
		await request(app).post("/api/sessions").send({ username: USERS.warden.email, password: "attacker-password" }).expect(401);
	});

	it("answers 409 Conflict", async () => {
		const res = await register({ ...NEW_USER, email: USERS.warden.email });
		expect(res.status).toBe(409);
	});
});
