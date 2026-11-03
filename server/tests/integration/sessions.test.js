import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../index.js";
import db from "../../config/db.js";
import { initSchema, resetDb, loginAsRole, getUserId, expectEnvelope, USERS } from "../helpers/helpers.js";

beforeAll(initSchema);
beforeEach(resetDb);
afterAll(() => db.close());

const credentials = (user) => ({ username: user.email, password: user.password });

describe("POST /api/sessions (login)", () => {
	it.each([["hiker", USERS.hiker], ["warden", USERS.warden]])("200 and the profile of the user, for a %s", async (_name, user) => {
		const res = await request(app).post("/api/sessions").send(credentials(user));

		expect(res.status).toBe(200);
		expectEnvelope(res, true);
		expect(res.body.data).toEqual({
			userId: await getUserId(user.email),
			role: user.role,
			fullName: user.fullName,
			email: user.email,
			phoneNumber: user.phoneNumber,
			notes: user.notes,
			emergencyContact: user.emergencyContact,
		});
	});

	it("never exposes the password hash or the salt", async () => {
		const res = await request(app).post("/api/sessions").send(credentials(USERS.hiker));

		expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|passwordSalt/);
	});


	it("401 on a wrong password, and no session is created", async () => {
		const agent = request.agent(app);
		const res = await agent.post("/api/sessions").send({ username: USERS.hiker.email, password: "wrong" });

		expect(res.status).toBe(401);
		expect((await agent.get("/api/sessions/current")).status).toBe(401);
	});

	it("401 on an unknown email", async () => {
		const res = await request(app).post("/api/sessions").send({ username: "nobody@example.com", password: "whatever" });
		expect(res.status).toBe(401);
	});

	it("is not vulnerable to SQL injection through the username", async () => {
		const res = await request(app).post("/api/sessions").send({ username: "' OR '1'='1", password: "' OR '1'='1" });
		expect(res.status).toBe(401);
	});

	it("400 when the credentials are missing", async () => {
		const res = await request(app).post("/api/sessions").send({ username: USERS.hiker.email });
		expect(res.status).toBe(400);
	});

	it("a second login on the same session replaces the first user", async () => {
		const agent = await loginAsRole("hiker");
		await agent.post("/api/sessions").send(credentials(USERS.warden)).expect(200);
		const current = await agent.get("/api/sessions/current");
		expect(current.body.data.email).toBe(USERS.warden.email);
	});

	it("two agents have independent sessions", async () => {
		const hiker = await loginAsRole("hiker");
		const warden = await loginAsRole("warden");
		expect((await hiker.get("/api/sessions/current")).body.data.role).toBe("HIKER");
		expect((await warden.get("/api/sessions/current")).body.data.role).toBe("WARDEN");
	});
});

describe("GET /api/sessions/current", () => {
	it("401 without a session", async () => {
		const res = await request(app).get("/api/sessions/current");
		expect(res.status).toBe(401);
		expectEnvelope(res, false);
	});

	it("200 and the logged user after the login", async () => {
		const agent = await loginAsRole("hiker");
		const res = await agent.get("/api/sessions/current");
		expect(res.status).toBe(200);
		expectEnvelope(res, true);
		expect(res.body.data).toMatchObject({ email: USERS.hiker.email, fullName: USERS.hiker.fullName, role: "HIKER" });
		expect(res.body.data).not.toHaveProperty("passwordHash");
	});
});

describe("DELETE /api/sessions/current (logout)", () => {
	it("200, and the session no longer grants access", async () => {
		const agent = await loginAsRole("hiker");
		const userId = await getUserId(USERS.hiker.email);
		const res = await agent.delete("/api/sessions/current");
		expect(res.status).toBe(200);
		expectEnvelope(res, true);
		expect((await agent.get("/api/sessions/current")).status).toBe(401);
		expect((await agent.get(`/api/users/${userId}`)).status).toBe(401);
	});

	it("200 also when nobody is logged in ", async () => {
		const res = await request(app).delete("/api/sessions/current");
		expect(res.status).toBe(200);
	});
});
