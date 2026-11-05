import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/db.js", () => ({
  default: { serialize: vi.fn(), run: vi.fn() },
}));

import db from "../../config/db.js";
import { withTransaction } from "../../utils/query.js";

const sqlRun = () => db.run.mock.calls.map(([sql]) => sql);

beforeEach(() => {
  vi.clearAllMocks();
  db.serialize.mockImplementation((fn) => fn());
  // sqlite3 calls the callback with `this` = statement info
  db.run.mockImplementation((sql, params, cb) => cb.call({ lastID: 1 }, null));
});

describe("withTransaction", () => {
  it("commits and returns the result when the body succeeds", async () => {
    const result = await withTransaction(async () => "done");

    expect(result).toBe("done");
    expect(sqlRun()).toEqual(["BEGIN TRANSACTION", "COMMIT"]);
  });

  it("rolls back and rethrows when the body fails", async () => {
    await expect(withTransaction(async () => { throw new Error("fail"); }))
      .rejects.toThrow("fail");

    expect(sqlRun()).toEqual(["BEGIN TRANSACTION", "ROLLBACK"]);
  });

  it("attaches the rollback error without hiding the original one", async () => {
    db.run.mockImplementation((sql, params, cb) =>
      cb.call({}, sql === "ROLLBACK" ? new Error("rollback failed") : null));

    await expect(withTransaction(async () => { throw new Error("fail"); }))
      .rejects.toMatchObject({ message: "fail", rollbackError: expect.any(Error) });
  });

  it("runs the body between BEGIN and COMMIT", async () => {
    const order = [];
    db.run.mockImplementation((sql, params, cb) => { order.push(sql); cb.call({}, null); });

    await withTransaction(async () => { order.push("body"); });

    expect(order).toEqual(["BEGIN TRANSACTION", "body", "COMMIT"]);
  });
});