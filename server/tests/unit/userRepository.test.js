import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

vi.mock("../../utils/query.js", () => ({
  queryAll: vi.fn(),
  queryGet: vi.fn(),
  queryRun: vi.fn(),
  withTransaction: vi.fn((fn) => fn()),
}));

import { queryAll, queryGet, queryRun } from "../../utils/query.js";
import { getUserById, getUserFromEmail, User, createHiker, getUserFromCredentials, updatePassword, PWD_HASH_LEN } from "../../repositories/userRepository.js";

const writes = (fragment) =>
  queryRun.mock.calls.filter(([sql]) => sql.includes(fragment));

const user = new User(42, "HIKER", "Test user", "this.is@anEmail.com", "+39 0123456789");
const userInDb = new User(4, "HIKER", "Giovanni Muciaccia", "gio.ilMucia@gmail.com", "+39 1212121212", null, "+39 9876543210");
	
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

describe("updatePassword", () => {

    it("returns true and updates password, hash and salt", async () => {
      queryRun.mockResolvedValue({ changes: 1 });

      const changes = await updatePassword(userInDb.userId, "mantide");
      expect(changes).toBeTruthy();
      expect(queryRun).toHaveBeenCalledTimes(1);
      
      const [, params] = queryRun.mock.calls[0];
      const [hashedPwd, salt, userId] = params;
      expect(userId).toEqual(userInDb.userId);
      expect(hashedPwd).toEqual(crypto.scryptSync("mantide", salt, PWD_HASH_LEN).toString("hex"));
    });

    it("returns false when user does not exists", async () => {
      queryRun.mockResolvedValue({ changes: 0 });

      const updated = await updatePassword(9999, "mantide");
      expect(updated).toBeFalsy();
    });
});