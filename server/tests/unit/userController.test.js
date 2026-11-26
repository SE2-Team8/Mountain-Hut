import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchHikers, getUser } from "../../services/userService";
import { responseError, responseSuccess } from "../../utils/response";
import userController from "../../controllers/userController";
import { HIKER_USER_1, HIKER_USER_2, USERS } from "../helpers/helpers.js"
import { sendPasswordSetupEmail } from "../../services/passwordService.js";
import { createHiker, getUserById, getUserFromEmail } from "../../repositories/userRepository.js";

vi.mock("../../services/userService.js", () => ({
    searchHikers: vi.fn(),
    getUser: vi.fn(),
}));
vi.mock("../../repositories/userRepository.js", () => ({
    getUserFromEmail: vi.fn(),
    createHiker: vi.fn(),
	getUserById: vi.fn(),
}));

vi.mock("../../services/passwordService.js", () => ({
	sendPasswordSetupEmail: vi.fn(),
}));

vi.mock("../../utils/response.js", () => ({
	responseSuccess: vi.fn(),
	responseError: vi.fn()
}));


beforeEach(() => vi.clearAllMocks());

describe("userController.searchHikers", () => {
    it("searches with the value of the query string", async () => {
		searchHikers.mockResolvedValue([]);

		await userController.searchHikers({ query: { value: "bianchi" } }, {});

		expect(searchHikers).toHaveBeenCalledTimes(1);
		expect(searchHikers).toHaveBeenCalledWith("bianchi");
	});

    it("answers success (default status 200) with the hikers found", async () => {
		const res = {};
		searchHikers.mockResolvedValue([HIKER_USER_1, HIKER_USER_2]);

		await userController.searchHikers({ query: { value: "i" } }, res);

		expect(responseSuccess).toHaveBeenCalledTimes(1);
		expect(responseSuccess).toHaveBeenCalledWith(res, [HIKER_USER_1, HIKER_USER_2], "Hikers retrieved");
		expect(responseError).not.toHaveBeenCalled();
	});

    // nobody found is not an error: the list is simply empty
	it("answers success with an empty list when nobody matches", async () => {
		const res = {};
		searchHikers.mockResolvedValue([]);

		await userController.searchHikers({ query: { value: "nobody" } }, res);

		expect(responseSuccess).toHaveBeenCalledWith(res, [], "Hikers retrieved");
		expect(responseError).not.toHaveBeenCalled();
	});

    it("does not add a status code: success answers with the default 200", async () => {
		searchHikers.mockResolvedValue([HIKER_USER_1, HIKER_USER_2]);

		await userController.searchHikers({ query: { value: "i" } }, {});

		expect(responseSuccess.mock.calls[0]).toHaveLength(3);
	});

    it("lets a service error go up (wrapController turns it into a 500)", async () => {
		searchHikers.mockRejectedValue(new Error("db down"));

		await expect(userController.searchHikers({ query: { value: "a" } }, {})).rejects.toThrow("db down");
		expect(responseSuccess).not.toHaveBeenCalled();
	});
});

describe("userController.get", () => {
    it("answers success with the user found", async () => {
		const res = {};
		getUser.mockResolvedValue(HIKER_USER_1);

		await userController.get({ params: { userId: "3" } }, res);

		expect(getUser).toHaveBeenCalledWith("3");
		expect(responseSuccess).toHaveBeenCalledWith(res, HIKER_USER_1, "User retrieved");
		expect(responseError).not.toHaveBeenCalled();
	});

    it("answers 404 when the user does not exist", async () => {
		getUser.mockResolvedValue(null);

		await userController.get({ params: { userId: "9999" } }, {});

		expect(responseError.mock.calls[0][3]).toBe(404);
		expect(responseSuccess).not.toHaveBeenCalled();
	});
});

// TODO: userController.post tests
describe("userController.post", () => {
	it.each([
		true,
		false
	])("answers success and answers 201, even if mail is not sent", async (mailSuccess) => {
		const res = {};
		const testUser = HIKER_USER_1;
		getUserFromEmail.mockResolvedValue(null);
		createHiker.mockResolvedValue(testUser.userId);
		getUserById.mockResolvedValue(testUser);
		sendPasswordSetupEmail.mockResolvedValue(mailSuccess);

		await userController.post({
			body: {
				email: testUser.email,
				fullName: testUser.fullName,
				phone: testUser.phone,
				notes: testUser.notes,
				emergencyContact: testUser.emergencyContact,
			}
		}, res);

		expect(getUserFromEmail).toHaveBeenCalledWith(testUser.email);
		expect(createHiker).toHaveBeenCalledWith(testUser.fullName, 
			testUser.email, testUser.phone, testUser.notes?.trim(),
			testUser.emergencyContact?.trim());
		expect(getUserById).toHaveBeenCalledWith(testUser.userId);
		expect(sendPasswordSetupEmail).toHaveBeenCalledWith(testUser);
		expect(responseSuccess).toHaveBeenCalledWith(res, 
			{...HIKER_USER_1, passwordSetupEmailSent: mailSuccess}, 
			expect.anything(), 201);
		expect(responseError).not.toHaveBeenCalled();
	});

	it("answers 409 when email already exists", async () => {
		const res = {};
		const testUser = HIKER_USER_1;
		getUserFromEmail.mockResolvedValue(HIKER_USER_2);

		await userController.post({
			body: {
				email: testUser.email,
				fullName: testUser.fullName,
				phone: testUser.phone,
				notes: testUser.notes,
				emergencyContact: testUser.emergencyContact,
			}
		}, res);

		expect(getUserFromEmail).toHaveBeenCalledWith(testUser.email);
		expect(createHiker).not.toHaveBeenCalled();
		expect(getUserById).not.toHaveBeenCalled();
		expect(sendPasswordSetupEmail).not.toHaveBeenCalled();
		expect(responseError).toHaveBeenCalledWith(res, null, expect.anything(), 409);
		expect(responseSuccess).not.toHaveBeenCalled();
	});

	it("answers 500 if user creation fails, and does not send emails", async () => {
		const res = {};
		const testUser = HIKER_USER_1;
		getUserFromEmail.mockResolvedValue(null);
		createHiker.mockResolvedValue(testUser.userId);
		getUserById.mockResolvedValue(null);

		await userController.post({
			body: {
				email: testUser.email,
				fullName: testUser.fullName,
				phone: testUser.phone,
				notes: testUser.notes,
				emergencyContact: testUser.emergencyContact,
			}
		}, res);

		expect(getUserFromEmail).toHaveBeenCalledWith(testUser.email);
		expect(createHiker).toHaveBeenCalledWith(testUser.fullName, 
			testUser.email, testUser.phone, testUser.notes?.trim(),
			testUser.emergencyContact?.trim());
		expect(getUserById).toHaveBeenCalledWith(testUser.userId);
		expect(responseError).toHaveBeenCalledWith(res, null, expect.anything(), 500);

		expect(sendPasswordSetupEmail).not.toHaveBeenCalled();
		expect(responseSuccess).not.toHaveBeenCalled();
	});

	
});