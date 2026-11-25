import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../repositories/userRepository.js", () => ({
    getHikerbyEmOrPhoneOrName: vi.fn(),
    getUserById: vi.fn(),
}));

import { getHikerbyEmOrPhoneOrName, getUserById } from "../../repositories/userRepository";
import { searchHikers, getUser } from "../../services/userService";

const hikers = [
    { userId: 3, role: "HIKER", fullName: "Paola Bianchi", email: "funnyhiker.82@gmail.com", phoneNumber: "+39 9876543210" },
    { userId: 5, role: "HIKER", fullName: "Giovanni Mucciaccia", email: "gio.ilMucia@gmail.com", phoneNumber: "+39 1212121212"},
];

beforeEach(() => vi.clearAllMocks());

describe("userService.searchHikers", () => {
    it("passes the searched value to the repository, unchanged", async () => {
		getHikerbyEmOrPhoneOrName.mockResolvedValue([]);

		await searchHikers("+39 987");

		expect(getHikerbyEmOrPhoneOrName).toHaveBeenCalledTimes(1);
		expect(getHikerbyEmOrPhoneOrName).toHaveBeenCalledWith("+39 987");
	});

    it("returns exactly the hikers found by the repository", async () => {
		getHikerbyEmOrPhoneOrName.mockResolvedValue(hikers);

		expect(await searchHikers("i")).toBe(hikers);
	});

    it("returns an empty array when the repository finds nobody", async () => {
		getHikerbyEmOrPhoneOrName.mockResolvedValue([]);

		expect(await searchHikers("nobody")).toEqual([]);
	});

    it("propagates a repository error", async () => {
		getHikerbyEmOrPhoneOrName.mockRejectedValue(new Error("db down"));

		await expect(searchHikers("a")).rejects.toThrow("db down");
	});

    it("does not use the lookup by id", async () => {
		getHikerbyEmOrPhoneOrName.mockResolvedValue([]);

		await searchHikers("a");

		expect(getUserById).not.toHaveBeenCalled();
	});
});

describe("userService.getUser", () => {
    it("returns the user found by id", async () => {
		getUserById.mockResolvedValue(hikers[0]);

		expect(await getUser(3)).toBe(hikers[0]);
		expect(getUserById).toHaveBeenCalledWith(3);
	});

    it("returns null when the user does not exist", async () => {
		getUserById.mockResolvedValue(null);

		expect(await getUser(9999)).toBeNull();
	});
});

