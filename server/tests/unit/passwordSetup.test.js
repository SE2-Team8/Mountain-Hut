import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../repositories/userRepository.js", () => ({
	createHiker: vi.fn(),
	getUserById: vi.fn(),
	getUserFromEmail: vi.fn(),
	getUserFromCredentials: vi.fn(),
	updatePassword: vi.fn(),
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

vi.mock("../../services/passwordService.js", () => ({
	completePasswordSetup: vi.fn(),
}));

vi.mock("../../utils/response.js", () => ({
	responseError: vi.fn(),
	responseSuccess: vi.fn(),
}));

import authController from "../../controllers/authController.js";
import { completePasswordSetup } from "../../services/passwordService.js";
import {
	responseError,
	responseSuccess,
} from "../../utils/response.js";
import {
	setInitialPassword,
	storePasswordSetupToken,
} from "../../repositories/userRepository.js";
import { sendTemplateEmail } from "../../services/smtpService.js";

const passwordService = await vi.importActual("../../services/passwordService.js");

const response = {};
const request = {
	body: { token: "a".repeat(64), password: "new-secure-password" },
};
const user = {
	userId: 17,
	fullName: "Mario Rossi",
	email: "mario@example.com",
};

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("authController.setupPassword", () => {
	it("sets the initial password and returns success for a valid setup token", async () => {
		completePasswordSetup.mockResolvedValue(true);

		await authController.setupPassword(request, response);

		expect(completePasswordSetup).toHaveBeenCalledWith(
			request.body.token,
			request.body.password,
		);
		expect(responseSuccess).toHaveBeenCalledWith(
			response,
			null,
			"Password set. You can now log in.",
		);
		expect(responseError).not.toHaveBeenCalled();
	});

	it("returns 400 when the setup token is invalid, expired, or already used", async () => {
		completePasswordSetup.mockResolvedValue(false);

		await authController.setupPassword(request, response);

		expect(responseError).toHaveBeenCalledWith(
			response,
			null,
			"This setup link is invalid, expired, or already used.",
			400,
		);
		expect(responseSuccess).not.toHaveBeenCalled();
	});
});

describe("passwordService.sendPasswordSetupEmail", () => {
	it("stores a hashed expiring token and emails the setup link", async () => {
		storePasswordSetupToken.mockResolvedValue(true);
		sendTemplateEmail.mockResolvedValue();
		const startedAt = Date.now();

		const result = await passwordService.sendPasswordSetupEmail(user);

		expect(result).toBe(true);
		expect(storePasswordSetupToken).toHaveBeenCalledTimes(1);
		const [userId, tokenHash, expiresAt] = storePasswordSetupToken.mock.calls[0];
		expect(userId).toBe(user.userId);
		expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
		expect(expiresAt).toBeGreaterThanOrEqual(startedAt + 24 * 60 * 60 * 1000);
		expect(expiresAt).toBeLessThanOrEqual(Date.now() + 24 * 60 * 60 * 1000);

		expect(sendTemplateEmail).toHaveBeenCalledTimes(1);
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
		expect(tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
		expect(mail.text).toContain(user.fullName);
		expect(mail.text).toContain(mail.data.setupUrl);
	});

	it("does not send an email when the setup token cannot be stored", async () => {
		storePasswordSetupToken.mockResolvedValue(false);

		await expect(passwordService.sendPasswordSetupEmail(user)).resolves.toBe(false);

		expect(storePasswordSetupToken).toHaveBeenCalledOnce();
		expect(sendTemplateEmail).not.toHaveBeenCalled();
	});

	it.each([
		["malformed URL", "not a URL"],
		["unsupported protocol", "ftp://localhost:5173"],
		["path", "http://localhost:5173/app"],
		["query string", "http://localhost:5173?next=/"],
		["fragment", "http://localhost:5173/#setup"],
		["credentials", "http://user:pass@localhost:5173"],
	])("does not send a setup email when the frontend URL has an invalid %s", async (_label, frontendUrl) => {
		vi.stubEnv("PUBLIC_APP_URL", frontendUrl);
		storePasswordSetupToken.mockResolvedValue(true);

		await expect(passwordService.sendPasswordSetupEmail(user))
			.rejects.toThrow();

		expect(storePasswordSetupToken).toHaveBeenCalledOnce();
		expect(sendTemplateEmail).not.toHaveBeenCalled();
	});
});

describe("passwordService.completePasswordSetup", () => {
	it("hashes the token before passing it to the repository", async () => {
		setInitialPassword.mockResolvedValue(true);

		await expect(
			passwordService.completePasswordSetup(request.body.token, request.body.password),
		).resolves.toBe(true);

		expect(setInitialPassword).toHaveBeenCalledWith(
			createHash("sha256")
				.update(request.body.token)
				.digest("hex"),
			request.body.password,
		);
	});
});
