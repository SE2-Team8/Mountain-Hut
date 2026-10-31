import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../repositories/reservationRepository.js", () => ({ createReservation: vi.fn() }));
vi.mock("../../utils/response.js", () => ({ responseSuccess: vi.fn(), responseError: vi.fn() }));

import { createReservation } from "../../repositories/reservationRepository.js";
import { responseSuccess, responseError } from "../../utils/response.js";
import reservationController from "../../controllers/reservationController.js";

const res = {};
const SESSION_USER = { userId: 7, role: "HIKER" };
const call = (body, user = SESSION_USER) => reservationController.create({ user, body }, res);

beforeEach(() => vi.clearAllMocks());

describe("reservationController.create", () => {
  it("books for the logged user, taking the id from the session", async () => {
    createReservation.mockResolvedValue(42);
    await call({ timeSlotId: 1, partySize: 4 });

    expect(createReservation).toHaveBeenCalledWith(1, 7, 4);
    expect(responseSuccess.mock.calls[0][3]).toBe(201);
  });

  it("ignores a userId sent in the body (no booking on behalf of others)", async () => {
    createReservation.mockResolvedValue(42);
    await call({ timeSlotId: 1, partySize: 2, userId: 999 });

    expect(createReservation).toHaveBeenCalledWith(1, 7, 2);
  });

  it.each([
    [{ partySize: 2 }],
    [{ timeSlotId: 1 }],
    [{}],
  ])("answers 400 when a field is missing (%j)", async (body) => {
    await call(body);

    expect(responseError.mock.calls[0][3]).toBe(400);
    expect(createReservation).not.toHaveBeenCalled();
  });

  it.each([0, -3, 1.5, "3", null])("answers 400 for invalid party size %s", async (partySize) => {
    await call({ timeSlotId: 1, partySize });

    expect(responseError.mock.calls[0][3]).toBe(400);
    expect(createReservation).not.toHaveBeenCalled();
  });

  it("lets repository errors reach the error handler", async () => {
    createReservation.mockRejectedValue(new Error("Not enough free seats"));

    await expect(call({ timeSlotId: 1, partySize: 50 })).rejects.toThrow("Not enough free seats");
    expect(responseSuccess).not.toHaveBeenCalled();
  });
});