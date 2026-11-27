import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail }) } }));

import app from "../../index.js";
import db from "../../config/db.js";
import { queryGet, queryRun } from "../../utils/query.js";
import {
	initSchema, resetDb, muteConsoleError, expectEnvelope, loginAsRole,
} from "../helpers/helpers.js";

const NEW_HIKER = {
	email: "setup.hiker@example.com",
	fullName: "Setup Hiker",
	phone: "+39 333 1112222",
	notes: "setup test hiker",
	emergencyContact: "+39 333 2223333",
};
const SETUP_PASSWORD = "new-secure-password";
const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const setupPassword = (token, password) =>
	request(app).post("/api/auth/setup-password").send({ token, password });

function getSetupToken(mail) {
	const href = mail.html.match(/href="([^"]+)"/)?.[1]?.replaceAll("&#x3D;", "=");
	const setupUrl = new URL(href);
	return new URLSearchParams(setupUrl.hash.slice(1)).get("token");
}

async function createPendingHiker() {
	const employee = await loginAsRole("employee");
	const res = await employee.post("/api/users").send(NEW_HIKER);
	expect(res.status).toBe(201);
	return getSetupToken(sendMail.mock.calls[0][0]);
}

beforeAll(initSchema);
beforeEach(async () => {
	muteConsoleError();
	await resetDb();
	sendMail.mockReset();
	sendMail.mockResolvedValue({ messageId: "test-id", accepted: [], rejected: [] });
});
afterAll(() => db.close());

describe("POST /api/auth/setup-password", () => {
	it("sets the initial password, consumes the hashed token, and enables login", async () => {
		const token = await createPendingHiker();
		const before = await queryGet(
			"SELECT passwordSetupTokenHash, passwordSetupExpiresAt, mustChangePassword FROM users WHERE email = ?",
			[NEW_HIKER.email],
		);
		expect(token).toMatch(/^[a-f0-9]{64}$/);
		expect(before.passwordSetupTokenHash).toBe(hashToken(token));
		expect(before.passwordSetupTokenHash).not.toBe(token);
		expect(before.passwordSetupExpiresAt).toBeGreaterThan(Date.now());
		expect(before.passwordSetupExpiresAt).toBeLessThanOrEqual(Date.now() + 24 * 60 * 60 * 1000);
		expect(before.mustChangePassword).toBe(1);

		const res = await setupPassword(token, SETUP_PASSWORD);

		expect(res.status).toBe(200);
		expectEnvelope(res, true);
		expect(res.body.message).toBe("Password set. You can now log in.");
		const after = await queryGet(
			"SELECT passwordSetupTokenHash, passwordSetupExpiresAt, mustChangePassword FROM users WHERE email = ?",
			[NEW_HIKER.email],
		);
		expect(after).toEqual({
			passwordSetupTokenHash: null,
			passwordSetupExpiresAt: null,
			mustChangePassword: 0,
		});
		await request(app).post("/api/auth/login")
			.send({ username: NEW_HIKER.email, password: SETUP_PASSWORD })
			.expect(200);
	});

	it("rejects a token after it has expired without enabling login", async () => {
		const token = await createPendingHiker();
		await queryRun(
			"UPDATE users SET passwordSetupExpiresAt = ? WHERE email = ?",
			[Date.now() - 1, NEW_HIKER.email],
		);

		const res = await setupPassword(token, SETUP_PASSWORD);

		expect(res.status).toBe(400);
		expectEnvelope(res, false);
		expect((await queryGet(
			"SELECT mustChangePassword FROM users WHERE email = ?",
			[NEW_HIKER.email],
		)).mustChangePassword).toBe(1);
		await request(app).post("/api/auth/login")
			.send({ username: NEW_HIKER.email, password: SETUP_PASSWORD })
			.expect(401);
	});

	it("rejects reuse of a setup token without changing the established password", async () => {
		const token = await createPendingHiker();
		const first = await setupPassword(token, SETUP_PASSWORD);
		expect(first.status).toBe(200);

		const second = await setupPassword(token, "another-password");

		expect(second.status).toBe(400);
		expectEnvelope(second, false);
		await request(app).post("/api/auth/login")
			.send({ username: NEW_HIKER.email, password: SETUP_PASSWORD })
			.expect(200);
		await request(app).post("/api/auth/login")
			.send({ username: NEW_HIKER.email, password: "another-password" })
			.expect(401);
	});

	it("rejects a well-formed token that does not belong to an account", async () => {
		const res = await setupPassword("a".repeat(64), SETUP_PASSWORD);

		expect(res.status).toBe(400);
		expectEnvelope(res, false);
	});

	it.each([
		["malformed token", { token: "not-a-token", password: SETUP_PASSWORD }],
		["non-string token", { token: 123, password: SETUP_PASSWORD }],
		["missing token", { password: SETUP_PASSWORD }],
		["missing password", { token: "a".repeat(64) }],
		["non-string password", { token: "a".repeat(64), password: 12345678 }],
		["short password", { token: "a".repeat(64), password: "short" }],
		["long password", { token: "a".repeat(64), password: "p".repeat(33) }],
		["blank password", { token: "a".repeat(64), password: "        " }],
	])("rejects %s without changing the pending account", async (_label, body) => {
		await createPendingHiker();

		const res = await request(app).post("/api/auth/setup-password").send(body);

		expect(res.status).toBe(422);
		expectEnvelope(res, false);
		expect((await queryGet(
			"SELECT mustChangePassword FROM users WHERE email = ?",
			[NEW_HIKER.email],
		)).mustChangePassword).toBe(1);
	});
});
