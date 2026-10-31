import { describe, it, expect, vi } from "vitest";
import { responseError } from "../../utils/response.js";
import requireRole from "../../middlewares/requireRole.js";

vi.mock("../../utils/response.js", () => ({ responseError: vi.fn() }));

const run = (req) => {
  const next = vi.fn();
  requireRole("HIKER")(req, {}, next);
  return next;
};

describe("requireRole('HIKER')", () => {
  it("answers 401 when not authenticated", () => {
    const next = run({ isAuthenticated: () => false });
    expect(responseError).toHaveBeenLastCalledWith({}, null, expect.any(String), 401);
    expect(next).not.toHaveBeenCalled();
  });

  it.each(["WARDEN", "EMPLOYEE"])("answers 403 for %s", (role) => {
    const next = run({ isAuthenticated: () => true, user: { role } });
    expect(responseError).toHaveBeenLastCalledWith({}, null, expect.any(String), 403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() for a hiker", () => {
    const next = run({ isAuthenticated: () => true, user: { role: "HIKER" } });
    expect(next).toHaveBeenCalledOnce();
  });
});