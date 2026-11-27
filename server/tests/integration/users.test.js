import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../index.js";
import db from "../../config/db.js";
import { initSchema, resetDb, loginAsRole, getUserId, expectEnvelope, USERS_BY_ROLE, HIKER_USER_2, HIKER_USER_1, EMPLOYEE_USER } from "../helpers/helpers.js";
import { UserRole } from "../../repositories/userRepository.js";

beforeAll(initSchema);
beforeEach(resetDb);
afterAll(() => db.close());

const newEmail = "not.tested@anEmail.com";

describe("GET /api/users/:userId", () => {
	it("401 with the standard error envelope when not authenticated", async () => {
		const res = await request(app).get(`/api/users/${await getUserId(USERS_BY_ROLE.hiker.email)}`);

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
		const res = await agent.get(`/api/users/${await getUserId(USERS_BY_ROLE.hiker.email)}`);

		expect(res.status).toBe(200);
		expect(res.body.data).toMatchObject({ email: USERS_BY_ROLE.hiker.email });
	});

	// any user can retrieve information about any other user, this functionality should be reserved only for the user
	// itself or to employees
	it("a hiker cannot read the profile of another user", async () => {
		const agent = await loginAsRole("hiker");
		const res = await agent.get(`/api/users/${await getUserId(USERS_BY_ROLE.hiker2.email)}`);
		expect(res.status).toBe(403);
	});
});

describe("POST /api/users", () => {
	// 403 when not authorized
	it("a hiker cannot create another user", async () => {
		const agent = await loginAsRole("hiker");
		const res = await agent.post(`/api/users/`).send({
			email: newEmail,
			fullName: HIKER_USER_1.fullName,
			phone: HIKER_USER_1.phoneNumber,
			notes: HIKER_USER_1.notes,
			emergencyContact: HIKER_USER_1.emergencyContact
		});
		expect(res.status).toBe(403);
		expectEnvelope(res, false);
	});

	// 409 when email already exists
	it("error when email already exists", async () => {
		const agent = await loginAsRole("employee");
		const res = await agent.post(`/api/users/`).send({
			email: HIKER_USER_1.email,
			fullName: HIKER_USER_1.fullName,
			phone: HIKER_USER_1.phoneNumber,
			notes: HIKER_USER_1.notes,
			emergencyContact: HIKER_USER_1.emergencyContact
		});
		expect(res.status).toBe(409);
		expectEnvelope(res, false);
	});


	// 201 when everything works
	it("correct response when everything goes smoothly", async () => {
		const agent = await loginAsRole("employee");
		const res = await agent.post(`/api/users/`).send({
			email: newEmail,
			fullName: HIKER_USER_1.fullName,
			phone: HIKER_USER_1.phoneNumber,
			notes: HIKER_USER_1.notes,
			emergencyContact: HIKER_USER_1.emergencyContact
		});
		expect(res.status).toBe(201);
		expectEnvelope(res, true);
		expect(res.body.data).toEqual({
			userId: expect.anything(),
			role: UserRole.HIKER,
			email: newEmail,
			fullName: HIKER_USER_1.fullName,
			phoneNumber: HIKER_USER_1.phoneNumber,
			notes: HIKER_USER_1.notes,
			emergencyContact: HIKER_USER_1.emergencyContact,
			mustChangePassword: true,
			passwordSetupEmailSent: true,
		})
	});

	// also works without specifying notes or emergency contact
	it("correct response when everything works - no notes or emergency contact", async () => {
		const agent = await loginAsRole("employee");
		const res = await agent.post(`/api/users`).send({
			email: newEmail,
			fullName: HIKER_USER_1.fullName,
			phone: HIKER_USER_1.phoneNumber,
			notes: "",
			emergencyContact: "",
		});
		expect(res.status).toBe(201);
		expectEnvelope(res, true);
		expect(res.body.data).toEqual({
			userId: expect.anything(),
			role: UserRole.HIKER,
			email: newEmail,
			fullName: HIKER_USER_1.fullName,
			phoneNumber: HIKER_USER_1.phoneNumber,
			notes: null,
			emergencyContact: null,
			mustChangePassword: true,
			passwordSetupEmailSent: true,
		})
	});
});