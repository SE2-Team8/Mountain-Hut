import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../services/userService.js", () => ({
    searchHikers: vi.fn(),
    getUser: vi.fn(),
}));
vi.mock("../../utils/response.js", () => ({ responseSuccess: vi.fn(), responseError: vi.fn() }));

import { searchHikers, getUser } from "../../services/userService";
import { responseError, responseSuccess } from "../../utils/response";
import userController from "../../controllers/userController";

const hikers = [
    { userId: 3, role: "HIKER", fullName: "Paola Bianchi", email: "funnyhiker.82@gmail.com", phoneNumber: "+39 9876543210" },
	{ userId: 5, role: "HIKER", fullName: "Giovanni Muciaccia", email: "gio.ilMucia@gmail.com", phoneNumber: "+39 1212121212" },
];

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
		searchHikers.mockResolvedValue(hikers);

		await userController.searchHikers({ query: { value: "i" } }, res);

		expect(responseSuccess).toHaveBeenCalledTimes(1);
		expect(responseSuccess).toHaveBeenCalledWith(res, hikers, "Hikers retrieved");
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
		searchHikers.mockResolvedValue(hikers);

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
		getUser.mockResolvedValue(hikers[0]);

		await userController.get({ params: { userId: "3" } }, res);

		expect(getUser).toHaveBeenCalledWith("3");
		expect(responseSuccess).toHaveBeenCalledWith(res, hikers[0], "User retrieved");
		expect(responseError).not.toHaveBeenCalled();
	});

    it("answers 404 when the user does not exist", async () => {
		getUser.mockResolvedValue(null);

		await userController.get({ params: { userId: "9999" } }, {});

		expect(responseError.mock.calls[0][3]).toBe(404);
		expect(responseSuccess).not.toHaveBeenCalled();
	});
})


