import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../index.js";
import db from "../../config/db.js";
import { initSchema, resetDb, muteConsoleError, expectEnvelope } from "../helpers/helpers.js";

beforeAll(initSchema);
beforeEach(async () => {
	muteConsoleError();
	await resetDb();
});
afterAll(() => db.close());

describe("CORS", () => {
	it.each([
		"http://localhost:5173",
	])("allows the origin %s, with credentials (the session cookie)", async (origin) => {
		const res = await request(app).get("/api/timeslots").set("Origin", origin);

		expect(res.status).toBe(200);
		expect(res.headers["access-control-allow-origin"]).toBe(origin);
		expect(res.headers["access-control-allow-credentials"]).toBe("true");
	});

	it.each([
		"http://evil.example.com",
		"http://localhost.evil.com",    
		"evilhttp://localhost",         
	])("refuses the origin %s: the response is an error and carries no CORS headers", async (origin) => {
		const res = await request(app).get("/api/timeslots").set("Origin", origin);

		expect(res.status).toBeGreaterThanOrEqual(400);
		expect(res.headers).not.toHaveProperty("access-control-allow-origin");
		expect(res.body.success).toBe(false);
	});

	it("answers the preflight of an allowed origin", async () => {
		const res = await request(app)
			.options("/api/sessions")
			.set("Origin", "http://localhost:5173")
			.set("Access-Control-Request-Method", "POST")
			.set("Access-Control-Request-Headers", "content-type");

		expect(res.status).toBe(204);
		expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
		expect(res.headers["access-control-allow-methods"]).toMatch(/POST/);
		expect(res.headers["access-control-allow-credentials"]).toBe("true");
	});
});

describe("unknown routes", () => {
	it.each([
		["GET", "/api/does-not-exist"],
	])("%s %s answers 404", async (method, path) => {
		const res = await request(app)[method.toLowerCase()](path);

		expect(res.status).toBe(404);
	});
});
