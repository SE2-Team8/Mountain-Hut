import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../utils/query.js", () => ({
  queryAll: vi.fn(),
  queryGet: vi.fn(),
  queryRun: vi.fn(),
  withTransaction: vi.fn((fn) => fn()),
}));

import { queryAll, queryGet, queryRun } from "../../utils/query.js";
import { getUserById, getUserFromEmail, User, createHiker } from "../../repositories/userRepository.js";

const writes = (fragment) =>
  queryRun.mock.calls.filter(([sql]) => sql.includes(fragment));

const user = new User(42, "HIKER", "Test user", "this.is@anEmail.com", "+39 0123456789");
	
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
		"password",
		user.fullName,
		user.email, 
		user.phoneNumber
	);
    expect(returnedUserId).toEqual(42);
  });

  it("throws error when same email exists, and does not alter db", async () => {
    queryGet.mockResolvedValue(user);
    await expect(createHiker(
		"password",
		user.fullName,
		user.email, 
		user.phoneNumber
	)).rejects.toThrow();
	expect(queryRun).toHaveBeenCalledTimes(0);
  });
});