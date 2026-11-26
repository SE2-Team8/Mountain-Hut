import { describe, it, expect, vi, beforeEach } from "vitest";

import { queryAll, queryGet, queryRun } from "../../utils/query.js";
import { getUserById, getUserFromEmail, User, createHiker, hashPassword, UserRole } from "../../repositories/userRepository.js";

vi.mock("../../utils/query.js", () => ({
  queryAll: vi.fn(),
  queryGet: vi.fn(),
  queryRun: vi.fn(),
  withTransaction: vi.fn((fn) => fn()),
}));

vi.mock('crypto', async (importOriginal) => {
	const actual = await importOriginal();

	const FIXED_SOURCE = Buffer.from(
		'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()'.repeat(64)
	);
	const randomBytes = vi.fn((size) => FIXED_SOURCE.subarray(0, size));

	return {
		...actual,
		randomBytes,
		default: { ...actual.default, randomBytes },
	};
});

const writes = (fragment) =>
  queryRun.mock.calls.filter(([sql]) => sql.includes(fragment));

const user = new User(42, "HIKER", "Test user", "this.is@anEmail.com", "+39 0123456789", "Professional hiker since 1974", "+39 9876543210");
	
beforeEach(() => vi.clearAllMocks());

describe("getUserById", () => {

  it("returns correct user when query is right", async () => {
	queryGet.mockResolvedValue(user);
    const returnedUser = await getUserById(user.userId);
    expect(returnedUser).toEqual(user);
  });

  it("returns null when user does not exist", async () => {
    queryGet.mockResolvedValue(null);
    const returnedUser = await getUserById(user.userId);
    expect(returnedUser).toEqual(null);
  });
});

describe("getUserByEmail", () => {

  it("returns correct user when query is right", async () => {
	queryGet.mockResolvedValue(user);
    const returnedUser = await getUserFromEmail(user.email);
    expect(returnedUser).toEqual(user);
  });

  it("returns null when user does not exist", async () => {
    queryGet.mockResolvedValue(null);
    const returnedUser = await getUserFromEmail(user.email);
    expect(returnedUser).toEqual(null);
  });
});

describe("createHiker", () => {

  it("returns correct id", async () => {
	queryGet.mockResolvedValue(null);
	queryRun.mockResolvedValue({lastID: 42});
    const returnedUserId = await createHiker(
		user.fullName,
		user.email, 
		user.phoneNumber,
		null,
		null,
		"password",
	);
    expect(returnedUserId).toEqual(42);
  });

  it("throws error when same email exists, and does not alter db", async () => {
    queryGet.mockResolvedValue(user);
    await expect(createHiker(
		user.fullName,
		user.email, 
		user.phoneNumber,
		null,
		null,
		"password"
	)).rejects.toThrow();
	expect(queryRun).toHaveBeenCalledTimes(0);
  });

  it.each(
	[
		["password", 0],
		[null, 1],
	]
  )("password must be changed if and only if not provided", async (password, expectedMustChange) => {
    queryGet.mockResolvedValue(null);
    await createHiker(
		user.fullName,
		user.email, 
		user.phoneNumber,
		null,
		null,
		password,
	);
	expect(queryRun.mock.calls[0][1][8]).toEqual(expectedMustChange);
  });

  it.each(
	[
		"password",
		"myWeakPassword",
		"mySecurePassword",
		"   	",
	]
  )("user data is written in db correctly, password is not stored as plaintext", async (password) => {
    queryGet.mockResolvedValue(null);
    await createHiker(
		user.fullName,
		user.email, 
		user.phoneNumber,
		user.notes,
		user.emergencyContact,
		password,
	);
	const sql_args = queryRun.mock.calls[0][1];
	const {  hash: expectedHash, salt: expectedSalt } = hashPassword(password);
	expect(sql_args).not.toContain(password);
	expect(sql_args).toEqual([
		expectedHash,
		expectedSalt,
		UserRole.HIKER,
		user.fullName,
		user.email,
		user.phoneNumber,
		user.notes,
		user.emergencyContact,
		expect.anything()
	])
  });
});