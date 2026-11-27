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

const response = {};
const request = {
	body: { token: "a".repeat(64), password: "new-secure-password" },
};

beforeEach(() => {
	vi.clearAllMocks();
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
