import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../utils/query.js", () => ({
    queryAll: vi.fn(),
    queryGet: vi.fn(),
    queryRun: vi.fn(),
    withTransaction: vi.fn((fn) => fn()),
}));

import { queryAll } from "../../utils/query";
import { getHikerbyEmOrPhoneOrName, User } from "../../repositories/userRepository";

// a row of the user tables, as sqlite returns it (with the passowrd data, that must never leave the repository)
const row = (overrides = {}) => ({
    userId: 3,
    passwordHash: "a1b2c3",
    passwordSalt: "d4e5f6",
    role: "HIKER",
    fullName: "Paola Bianchi",
    email: "funnyhiker.82@gmail.com",
    phoneNumber: "+39 9876543210",
    notes: "registered mountain guide",
    emergencyContact: "+39 8765432109",
    mustChangePassword: 0,
    ...overrides,
});

// the sql text and the parameters of the (only) query
const lastQuery = () => {
    const [sql, params] = queryAll.mock.calls[0];
    return { sql, params };
};

beforeEach(() => {
    vi.clearAllMocks();
    queryAll.mockResolvedValue([]);
});

describe("getHikerByEmOrPhoneOrName - query", () => {
    it("runs a single query, only on hikers, with the value inside % for email, phone and name", async () => {
		await getHikerbyEmOrPhoneOrName("bianchi");

		expect(queryAll).toHaveBeenCalledTimes(1);
		expect(lastQuery().params).toEqual(["HIKER", "%bianchi%", "%bianchi%", "%bianchi%"]);
	});

    it("searches in the email, the phone number and the full name", async () => {
		await getHikerbyEmOrPhoneOrName("x");

		const { sql } = lastQuery();
		expect(sql).toMatch(/email\s+LIKE\s+\?/i);
		expect(sql).toMatch(/phoneNumber\s+LIKE\s+\?/i);
		expect(sql).toMatch(/fullName\s+LIKE\s+\?/i);
	});

    it("filters on the role with a parameter, so staff users are never returned by the query", async () => {
		await getHikerbyEmOrPhoneOrName("rossi");

		const { sql, params } = lastQuery();
		expect(sql).toMatch(/role\s*=\s*\?/i);
		expect(params[0]).toBe("HIKER");
	});

    it("sorts the results by full name", async () => {
		await getHikerbyEmOrPhoneOrName("a");

		expect(lastQuery().sql).toMatch(/ORDER BY\s+fullName/i);
	});

    //the value must travel only as a parameter: never concatenated into the sql text
    it.each([
		["a quote and an sql comment", "x' OR 1=1 --"],
		["a semicolon and another statement", "a'; DROP TABLE users; --"],
	])("keeps a value with %s out of the sql text (no sql injection)", async (_label, value) => {
		await getHikerbyEmOrPhoneOrName(value);

		const { sql, params } = lastQuery();
		expect(sql).not.toContain(value);
		expect(params).toEqual(["HIKER", `%${value}%`, `%${value}%`, `%${value}%`]);
	});

    it("passes a phone number with spaces and + exactly as written", async () => {
		await getHikerbyEmOrPhoneOrName("+39 987");

		expect(lastQuery().params.slice(1)).toEqual(["%+39 987%", "%+39 987%", "%+39 987%"]);
	});

    it("passes an email exactly as written", async () => {
		await getHikerbyEmOrPhoneOrName("funnyhiker.82@gmail.com");

		expect(lastQuery().params[1]).toBe("%funnyhiker.82@gmail.com%");
	});
});

describe("getHikerByEmOrPhoneOrName - results", () => {
    it("returns an empty array when nobody matches", async () => {
		queryAll.mockResolvedValue([]);

		expect(await getHikerbyEmOrPhoneOrName("nobody")).toEqual([]);
	});

    it("returns one User for each row, with all the profile fields", async () => {
		queryAll.mockResolvedValue([row()]);

		const result = await getHikerbyEmOrPhoneOrName("paola");

		expect(result).toHaveLength(1);
		expect(result[0]).toBeInstanceOf(User);
		expect(result[0]).toEqual(new User(3, "HIKER", "Paola Bianchi", "funnyhiker.82@gmail.com",
			"+39 9876543210", "registered mountain guide", "+39 8765432109", false));
	});

    it("keeps the order of the rows returned by the database", async () => {
		queryAll.mockResolvedValue([
			row({ userId: 7, fullName: "Anna Neri" }),
			row({ userId: 3, fullName: "Paola Bianchi" }),
			row({ userId: 5, fullName: "Zeno Verdi" }),
		]);

		const result = await getHikerbyEmOrPhoneOrName("a");

		expect(result.map((u) => u.userId)).toEqual([7, 3, 5]);
	});

    it("never exposes the password hash or the salt", async () => {
		queryAll.mockResolvedValue([row(), row({ userId: 4 })]);

		for (const user of await getHikerbyEmOrPhoneOrName("a")) {
			expect(user).not.toHaveProperty("passwordHash");
			expect(user).not.toHaveProperty("passwordSalt");
			expect(JSON.stringify(user)).not.toContain("a1b2c3");
		}
	});

    it("turns the mustChangePassword column (0/1) into a boolean", async () => {
		queryAll.mockResolvedValue([row({ userId: 1, mustChangePassword: 1 }), row({ userId: 2, mustChangePassword: 0 })]);

		const [first, second] = await getHikerbyEmOrPhoneOrName("a");

		expect(first.mustChangePassword).toBe(true);
		expect(second.mustChangePassword).toBe(false);
	});

    it("keeps null notes and emergency contact as null", async () => {
		queryAll.mockResolvedValue([row({ notes: null, emergencyContact: null })]);

		const [user] = await getHikerbyEmOrPhoneOrName("a");

		expect(user.notes).toBeNull();
		expect(user.emergencyContact).toBeNull();
	});

    it("propagates a database error to the caller", async () => {
		queryAll.mockRejectedValue(new Error("db down"));

		await expect(getHikerbyEmOrPhoneOrName("a")).rejects.toThrow("db down");
	});
})

