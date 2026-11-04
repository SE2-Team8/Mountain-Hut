import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../index.js";
import db from "../../config/db.js";
import { initSchema, resetDb, loginAsRole, getUserId, expectEnvelope, USERS } from "../helpers/helpers.js";

beforeAll(initSchema);
beforeEach(resetDb);
afterAll(() => db.close());

describe("GET /api/users/:id", () => {
	it("401 with the standard error envelope when not authenticated", async () => {
		const res = await request(app).get(`/api/users/${await getUserId(USERS.hiker.email)}`);

		expect(res.status).toBe(401);
		expectEnvelope(res, false);
	});

	it("404 when the user does not exist", async () => {
		const agent = await loginAsRole("warden");
		const res = await agent.get("/api/users/9999");

		expect(res.status).toBe(404);
		expectEnvelope(res, false);
	});

	it("a warden can read the profile of a hiker", async () => {
		const agent = await loginAsRole("warden");
		const res = await agent.get(`/api/users/${await getUserId(USERS.hiker.email)}`);

		expect(res.status).toBe(200);
		expect(res.body.data).toMatchObject({ email: USERS.hiker.email });
	});

	// any user can retrieve information about any other user, this functionality should be reserved only for the user
	// itself or to employees
	it("a hiker cannot read the profile of another user", async () => {
		const agent = await loginAsRole("hiker");
		const res = await agent.get(`/api/users/${await getUserId(USERS.hiker2.email)}`);
		expect(res.status).toBe(403);
	});
});
