import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../repositories/userRepository.js", () => ({
	createHiker: vi.fn(),
	getUserById: vi.fn(),
	getUserFromEmail: vi.fn(),
	getUserFromCredentials: vi.fn(),
	updatePassword: vi.fn(),
}));

vi.mock("../../services/passwordService.js", () => ({
	completePasswordSetup: vi.fn(),
	sendPasswordResetEmail: vi.fn(),
	findPasswordResetToken: vi.fn(),
	discardPasswordResetToken: vi.fn(),
	completePasswordReset: vi.fn(),
}));

vi.mock("../../services/smtpService.js", () => ({
	sendTemplateEmail: vi.fn(),
}));

vi.mock("../../utils/response.js", () => ({
	responseError: vi.fn(),
	responseSuccess: vi.fn(),
}));

import authController from "../../controllers/authController.js";
import {
	getUserById,
	getUserFromEmail,
} from "../../repositories/userRepository.js";
import {
	sendPasswordResetEmail,
	findPasswordResetToken,
	discardPasswordResetToken,
	completePasswordReset,
} from "../../services/passwordService.js";
import { sendTemplateEmail } from "../../services/smtpService.js";
import {
	responseError,
	responseSuccess,
} from "../../utils/response.js";

const user = {
	userId: 42,
	fullName: "Mario Rossi",
	email: "mario@example.com",
};

const response = {};

beforeEach(() => {
	vi.clearAllMocks();
	getUserFromEmail.mockResolvedValue(user);
	sendPasswordResetEmail.mockResolvedValue();
	findPasswordResetToken.mockResolvedValue(null);
	discardPasswordResetToken.mockResolvedValue();
	completePasswordReset.mockResolvedValue(true);
	getUserById.mockResolvedValue(user);
	sendTemplateEmail.mockResolvedValue();
});

describe("authController.forgotPassword", () => {
	it("sends a reset email for a registered address and returns the generic response", async () => {
		const req = { body: { email: user.email } };

		await authController.forgotPassword(req, response);

		expect(getUserFromEmail).toHaveBeenCalledWith(user.email);
		expect(sendPasswordResetEmail).toHaveBeenCalledWith(user);
		expect(responseSuccess).toHaveBeenCalledWith(
			response,
			null,
			"If the email is registered, a link to reset the password has been sent",
		);
		expect(responseError).not.toHaveBeenCalled();
	});

	it("returns the same response without sending an email for an unknown address", async () => {
		getUserFromEmail.mockResolvedValue(null);

		await authController.forgotPassword({ body: { email: "unknown@example.com" } }, response);

		expect(sendPasswordResetEmail).not.toHaveBeenCalled();
		expect(responseSuccess).toHaveBeenCalledWith(
			response,
			null,
			"If the email is registered, a link to reset the password has been sent",
		);
	});

	it("returns the generic response and logs an email delivery failure", async () => {
		const error = new Error("SMTP unavailable");
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		sendPasswordResetEmail.mockRejectedValue(error);

		await authController.forgotPassword({ body: { email: user.email } }, response);

		expect(consoleError).toHaveBeenCalledWith(
			"The password reset email could not be sent:",
			error,
		);
		expect(responseSuccess).toHaveBeenCalledWith(
			response,
			null,
			"If the email is registered, a link to reset the password has been sent",
		);
		consoleError.mockRestore();
	});
});

describe("authController.setNewPassword", () => {
	const req = {
		body: { token: "a".repeat(64), password: "new-secure-password" },
	};

	it("returns 400 when the token is invalid or already used", async () => {
		findPasswordResetToken.mockResolvedValue(null);

		await authController.setNewPassword(req, response);

		expect(findPasswordResetToken).toHaveBeenCalledWith(req.body.token);
		expect(responseError).toHaveBeenCalledWith(
			response,
			null,
			"The reset link is not valid or has already been used",
			400,
		);
		expect(completePasswordReset).not.toHaveBeenCalled();
		expect(sendTemplateEmail).not.toHaveBeenCalled();
	});

	it("discards an expired token and returns 409", async () => {
		findPasswordResetToken.mockResolvedValue({
			userId: user.userId,
			expiresAt: Date.now() - 1,
		});

		await authController.setNewPassword(req, response);

		expect(discardPasswordResetToken).toHaveBeenCalledWith(user.userId);
		expect(completePasswordReset).not.toHaveBeenCalled();
		expect(responseError).toHaveBeenCalledWith(
			response,
			null,
			"The reset link has expired, ask for a new one",
			409,
		);
		expect(sendTemplateEmail).not.toHaveBeenCalled();
	});

	it("sets the new password, sends a notification, and returns success", async () => {
		findPasswordResetToken.mockResolvedValue({
			userId: user.userId,
			expiresAt: Date.now() + 60_000,
		});

		await authController.setNewPassword(req, response);

		expect(completePasswordReset).toHaveBeenCalledWith(
			req.body.token,
			req.body.password,
		);
		expect(getUserById).toHaveBeenCalledWith(user.userId);
		expect(sendTemplateEmail).toHaveBeenCalledWith({
			to: user.email,
			subject: "Your password has been changed",
			templateName: "password-changed",
			data: {
				user: { fullName: user.fullName },
				changedAt: expect.any(String),
			},
			text: "The password of your Mountain Hut account has been changed.",
		});
		expect(responseSuccess).toHaveBeenCalledWith(
			response,
			null,
			"Password successfully set",
		);
		expect(responseError).not.toHaveBeenCalled();
	});

	it("returns 400 if the token is used between lookup and password update", async () => {
		findPasswordResetToken.mockResolvedValue({
			userId: user.userId,
			expiresAt: Date.now() + 60_000,
		});
		completePasswordReset.mockResolvedValue(false);

		await authController.setNewPassword(req, response);

		expect(responseError).toHaveBeenCalledWith(
			response,
			null,
			"The reset link is not valid or has already been used",
			400,
		);
		expect(getUserById).not.toHaveBeenCalled();
		expect(sendTemplateEmail).not.toHaveBeenCalled();
	});
});