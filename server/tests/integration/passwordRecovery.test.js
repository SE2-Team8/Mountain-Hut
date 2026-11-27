import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail }) } }));

import app from "../../index.js";
import db from "../../config/db.js";
import { queryGet, queryRun } from "../../utils/query.js";
import {
	initSchema, resetDb, muteConsoleError, expectEnvelope, HIKER_USER_1,
} from "../helpers/helpers.js";

const RESET_PASSWORD = "new-secure-password";
const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const forgotPassword = (email) => request(app).post("/api/auth/forgot-password").send({ email });
const setNewPassword = (token, password) => request(app).post("/api/auth/set-new-password").send({ token, password });

function getResetUrl(mail) {
	const href = mail.html.match(/href="([^"]+)"/)?.[1]?.replaceAll("&#x3D;", "=");
	return new URL(href);
}

async function requestResetToken(email = HIKER_USER_1.email) {
	await forgotPassword(email);
	const mail = sendMail.mock.calls[0][0];
	const resetUrl = getResetUrl(mail);
	return resetUrl.hash.slice(1).match(/(?:^|&)token=([a-f0-9]{64})(?:&|$)/)[1];
}

beforeAll(initSchema);
beforeEach(async () => {
	muteConsoleError();
	await resetDb();
	sendMail.mockResolvedValue({ messageId: "test-id", accepted: [], rejected: [] });
});
afterAll(() => db.close());

describe("POST /api/auth/forgot-password", () => {
	it("sends a reset email for a registered address and stores only a hashed, expiring token", async () => {
		const res = await forgotPassword(HIKER_USER_1.email);

		expect(res.status).toBe(200);
		expectEnvelope(res, true);
		expect(res.body.message).toBe("If the email is registered, a link to reset the password has been sent");
		expect(sendMail).toHaveBeenCalledTimes(1);

		const mail = sendMail.mock.calls[0][0];
		expect(mail.to).toBe(HIKER_USER_1.email);
		expect(mail.subject).toBe("Reset your Mountain Hut password");
		expect(mail.html).toContain(`Hello, ${HIKER_USER_1.fullName}!`);
		expect(mail.html).toContain("Reset password");
		const resetUrl = getResetUrl(mail);
		expect(resetUrl.origin).toBe("http://localhost:5173");
		expect(resetUrl.pathname).toBe("/auth/reset-password");
		const token = new URLSearchParams(resetUrl.hash.slice(1)).get("token");
		expect(token).toMatch(/^[a-f0-9]{64}$/);
		expect(mail.html).toContain(token);
		const row = await queryGet(
			"SELECT passwordResetTokenHash, passwordResetExpiresAt FROM users WHERE email = ?",
			[HIKER_USER_1.email]
		);
		expect(row.passwordResetTokenHash).toBe(hashToken(token));
		expect(row.passwordResetTokenHash).not.toBe(token);
		expect(row.passwordResetExpiresAt).toBeGreaterThan(Date.now());
		expect(row.passwordResetExpiresAt).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000);
	});

	it("returns the same response for an unregistered address without sending email", async () => {
		const res = await forgotPassword("unknown@example.com");

		expect(res.status).toBe(200);
		expectEnvelope(res, true);
		expect(res.body.message).toBe("If the email is registered, a link to reset the password has been sent");
		expect(sendMail).not.toHaveBeenCalled();
	});

	it.each([
		["missing email", {}],
		["invalid email", { email: "not-an-email" }],
		["unexpected field", { email: HIKER_USER_1.email, extra: true }],
	])("rejects %s and does not send an email", async (_label, body) => {
		const res = await request(app).post("/api/auth/forgot-password").send(body);

		expect(res.status).toBe(422);
		expectEnvelope(res, false);
		expect(sendMail).not.toHaveBeenCalled();
	});
});

describe("POST /api/auth/set-new-password", () => {
	it("sets the new password with a valid token, consumes the token, and emails a notification", async () => {
		const token = await requestResetToken();
		sendMail.mockClear();

		const res = await setNewPassword(token, RESET_PASSWORD);

		expect(res.status).toBe(200);
		expectEnvelope(res, true);
		expect(res.body.message).toBe("Password successfully set");
		expect(sendMail).toHaveBeenCalledTimes(1);
		expect(sendMail.mock.calls[0][0]).toMatchObject({
			to: HIKER_USER_1.email,
			subject: "Your password has been changed",
		});

		const row = await queryGet(
			"SELECT passwordResetTokenHash, passwordResetExpiresAt FROM users WHERE email = ?",
			[HIKER_USER_1.email]
		);
		expect(row.passwordResetTokenHash).toBeNull();
		expect(row.passwordResetExpiresAt).toBeNull();

		await request(app).post("/api/auth/login")
			.send({ username: HIKER_USER_1.email, password: HIKER_USER_1.password })
			.expect(401);
		await request(app).post("/api/auth/login")
			.send({ username: HIKER_USER_1.email, password: RESET_PASSWORD })
			.expect(200);
	});

	it("rejects an invalid or already-used token without changing the password", async () => {
		const token = await requestResetToken();

		const first = await setNewPassword(token, RESET_PASSWORD);
		expect(first.status).toBe(200);

		const second = await setNewPassword(token, "another-password");
		expect(second.status).toBe(400);
		expectEnvelope(second, false);
		await request(app).post("/api/auth/login")
			.send({ username: HIKER_USER_1.email, password: RESET_PASSWORD })
			.expect(200);
	});

	it("rejects an expired token and leaves the password unchanged", async () => {
		const token = await requestResetToken();
		await queryRun(
			"UPDATE users SET passwordResetExpiresAt = ? WHERE email = ?",
			[Date.now() - 1, HIKER_USER_1.email]
		);

		const res = await setNewPassword(token, RESET_PASSWORD);

		expect(res.status).toBe(409);
		expectEnvelope(res, false);
		expect(sendMail).toHaveBeenCalledTimes(1);
		await request(app).post("/api/auth/login")
			.send({ username: HIKER_USER_1.email, password: HIKER_USER_1.password })
			.expect(200);
	});

	it.each([
		["malformed token", { token: "not-a-token", password: RESET_PASSWORD }],
		["missing password", { token: "a".repeat(64) }],
		["short password", { token: "a".repeat(64), password: "short" }],
		["blank password", { token: "a".repeat(64), password: "        " }],
		["unexpected field", { token: "a".repeat(64), password: RESET_PASSWORD, extra: true }],
	])("rejects %s without changing credentials", async (_label, body) => {
		const res = await request(app).post("/api/auth/set-new-password").send(body);

		expect(res.status).toBe(422);
		expectEnvelope(res, false);
		expect(sendMail).not.toHaveBeenCalled();
		await request(app).post("/api/auth/login")
			.send({ username: HIKER_USER_1.email, password: HIKER_USER_1.password })
			.expect(200);
	});
});