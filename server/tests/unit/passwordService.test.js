import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../repositories/userRepository.js", () => ({
	setInitialPassword: vi.fn(),
	storePasswordSetupToken: vi.fn(),
	storePasswordResetToken: vi.fn(),
	getPasswordResetToken: vi.fn(),
	clearPasswordResetToken: vi.fn(),
	resetPasswordWithToken: vi.fn(),
}));

vi.mock("../../services/smtpService.js", () => ({
	sendTemplateEmail: vi.fn(),
}));

import {
	clearPasswordResetToken,
	getPasswordResetToken,
	resetPasswordWithToken,
	setInitialPassword,
	storePasswordResetToken,
	storePasswordSetupToken,
} from "../../repositories/userRepository.js";
import { sendTemplateEmail } from "../../services/smtpService.js";
import {
	completePasswordReset,
	completePasswordSetup,
	discardPasswordResetToken,
	findPasswordResetToken,
	sendPasswordResetEmail,
	sendPasswordSetupEmail,
} from "../../services/passwordService.js";

const user = {
	userId: 17,
	fullName: "Mario Rossi",
	email: "mario@example.com",
};
const hashToken = (token) => createHash("sha256").update(token).digest("hex");

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubEnv("PUBLIC_APP_URL", "http://localhost:5173");
	sendTemplateEmail.mockResolvedValue();
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("sendPasswordSetupEmail", () => {
	it("stores a hashed 24-hour token and emails the setup link", async () => {
		storePasswordSetupToken.mockResolvedValue(true);
		const startedAt = Date.now();

		await expect(sendPasswordSetupEmail(user)).resolves.toBe(true);

		expect(storePasswordSetupToken).toHaveBeenCalledOnce();
		const [userId, tokenHash, expiresAt] = storePasswordSetupToken.mock.calls[0];
		expect(userId).toBe(user.userId);
		expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
		expect(expiresAt).toBeGreaterThanOrEqual(startedAt + 24 * 60 * 60 * 1000);
		expect(expiresAt).toBeLessThanOrEqual(Date.now() + 24 * 60 * 60 * 1000);

		expect(sendTemplateEmail).toHaveBeenCalledOnce();
		const mail = sendTemplateEmail.mock.calls[0][0];
		expect(mail).toMatchObject({
			to: user.email,
			subject: "Set up your Mountain Hut password",
			templateName: "password-setup",
			data: { fullName: user.fullName },
		});
		const setupUrl = new URL(mail.data.setupUrl);
		const token = new URLSearchParams(setupUrl.hash.slice(1)).get("token");
		expect(setupUrl.origin).toBe("http://localhost:5173");
		expect(setupUrl.pathname).toBe("/auth/setup-password");
		expect(token).toMatch(/^[a-f0-9]{64}$/);
		expect(tokenHash).toBe(hashToken(token));
		expect(mail.text).toContain(user.fullName);
		expect(mail.text).toContain(mail.data.setupUrl);
	});

	it("does not send email when the setup token cannot be stored", async () => {
		storePasswordSetupToken.mockResolvedValue(false);

		await expect(sendPasswordSetupEmail(user)).resolves.toBe(false);

		expect(storePasswordSetupToken).toHaveBeenCalledOnce();
		expect(sendTemplateEmail).not.toHaveBeenCalled();
	});
});

describe("completePasswordSetup", () => {
	it("hashes the token before passing it to the repository", async () => {
		setInitialPassword.mockResolvedValue(true);

		await expect(completePasswordSetup("setup-token", "new-password")).resolves.toBe(true);

		expect(setInitialPassword).toHaveBeenCalledWith(hashToken("setup-token"), "new-password");
	});
});

describe("sendPasswordResetEmail", () => {
	it("stores a hashed 15-minute token and emails the reset link", async () => {
		storePasswordResetToken.mockResolvedValue(true);
		const startedAt = Date.now();

		await sendPasswordResetEmail(user);

		expect(storePasswordResetToken).toHaveBeenCalledOnce();
		const [userId, tokenHash, expiresAt] = storePasswordResetToken.mock.calls[0];
		expect(userId).toBe(user.userId);
		expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
		expect(expiresAt).toBeGreaterThanOrEqual(startedAt + 15 * 60 * 1000);
		expect(expiresAt).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000);

		expect(sendTemplateEmail).toHaveBeenCalledOnce();
		const mail = sendTemplateEmail.mock.calls[0][0];
		expect(mail).toMatchObject({
			to: user.email,
			subject: "Reset your Mountain Hut password",
			templateName: "password-reset",
			data: { fullName: user.fullName },
		});
		const resetUrl = new URL(mail.data.resetUrl);
		const token = new URLSearchParams(resetUrl.hash.slice(1)).get("token");
		expect(resetUrl.origin).toBe("http://localhost:5173");
		expect(resetUrl.pathname).toBe("/auth/reset-password");
		expect(token).toMatch(/^[a-f0-9]{64}$/);
		expect(tokenHash).toBe(hashToken(token));
		expect(mail.text).toContain(user.fullName);
		expect(mail.text).toContain(mail.data.resetUrl);
	});

	it.each([
		["malformed URL", "not a URL"],
		["unsupported protocol", "ftp://localhost:5173"],
		["path", "http://localhost:5173/app"],
		["query string", "http://localhost:5173?next=/"],
		["fragment", "http://localhost:5173/#reset"],
		["credentials", "http://user:pass@localhost:5173"],
	])("rejects a frontend URL with an invalid %s before storing a token", async (_label, frontendUrl) => {
		vi.stubEnv("PUBLIC_APP_URL", frontendUrl);

		await expect(sendPasswordResetEmail(user))
			.rejects.toThrow("PUBLIC_APP_URL is missing or not valid: the reset link cannot be built");

		expect(storePasswordResetToken).not.toHaveBeenCalled();
		expect(sendTemplateEmail).not.toHaveBeenCalled();
	});
});

describe("findPasswordResetToken", () => {
	it("hashes the token before looking it up", async () => {
		const tokenInfo = { userId: user.userId, expiresAt: Date.now() + 60_000 };
		getPasswordResetToken.mockResolvedValue(tokenInfo);

		await expect(findPasswordResetToken("reset-token")).resolves.toBe(tokenInfo);

		expect(getPasswordResetToken).toHaveBeenCalledWith(hashToken("reset-token"));
	});
});

describe("discardPasswordResetToken", () => {
	it("clears the reset token for the given user", async () => {
		clearPasswordResetToken.mockResolvedValue();

		await discardPasswordResetToken(user.userId);

		expect(clearPasswordResetToken).toHaveBeenCalledWith(user.userId);
	});
});

describe("completePasswordReset", () => {
	it("hashes the token before passing it to the repository", async () => {
		resetPasswordWithToken.mockResolvedValue(true);

		await expect(completePasswordReset("reset-token", "new-password")).resolves.toBe(true);

		expect(resetPasswordWithToken).toHaveBeenCalledWith(
			hashToken("reset-token"),
			"new-password",
		);
	});
});
