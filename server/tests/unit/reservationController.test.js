import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../repositories/reservationRepository.js", () => ({
  createReservation: vi.fn(),
  getReservationsByUser: vi.fn(),
}));
vi.mock("../../repositories/timeSlotRepository.js", () => ({
  getTimeSlotById: vi.fn(),
}));
vi.mock("../../utils/response.js", () => ({ responseSuccess: vi.fn(), responseError: vi.fn() }));

import { createReservation, getReservationsByUser } from "../../repositories/reservationRepository.js";
import { getTimeSlotById } from "../../repositories/timeSlotRepository.js";
import { responseSuccess, responseError } from "../../utils/response.js";
import reservationController from "../../controllers/reservationController.js";

const NOW = new Date("2027-03-10T10:00:00Z");
const HOUR = 3600e3;
const res = {};
const SESSION_USER = { userId: 7, role: "HIKER" };
const call = (body, user = SESSION_USER) => reservationController.create({ user, body }, res);
const slotStartingIn = (ms) => ({ timeSlotId: 1, startDateTime: new Date(NOW.getTime() + ms) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  getTimeSlotById.mockResolvedValue(slotStartingIn(24 * HOUR));
  getReservationsByUser.mockResolvedValue([]);
  createReservation.mockResolvedValue(42);
});
afterEach(() => vi.useRealTimers());

describe("reservationController.create - happy path", () => {
  it("books for the logged user, taking the id from the session, and answers 201", async () => {
    await call({ timeSlotId: 1, partySize: 4 });

    expect(createReservation).toHaveBeenCalledWith(7, 1, 4);
    expect(responseSuccess).toHaveBeenCalledWith(res, 42, expect.any(String), 201);
  });

  it("ignores a userId sent in the body (no booking on behalf of others)", async () => {
    await call({ timeSlotId: 1, partySize: 2, userId: 999 });

    expect(createReservation).toHaveBeenCalledWith(7, 1, 2);
  });
});

describe("reservationController.create - input validation", () => {
  it("answers 404 for a time slot that does not exist (instead of crashing)", async () => {
    getTimeSlotById.mockResolvedValue(null);

    await call({ timeSlotId: 99, partySize: 2 });

    expect(responseError.mock.calls[0][3]).toBe(404);
    expect(createReservation).not.toHaveBeenCalled();
  });
});

describe("reservationController.create - 2 hours rule", () => {
  it("accepts a reservation made exactly 2 hours before the slot", async () => {
    getTimeSlotById.mockResolvedValue(slotStartingIn(2 * HOUR));
    await call({ timeSlotId: 1, partySize: 2 });

    expect(createReservation).toHaveBeenCalled();
  });

  it("rejects a reservation made 1 minute too late", async () => {
    getTimeSlotById.mockResolvedValue(slotStartingIn(2 * HOUR - 60e3));
    await call({ timeSlotId: 1, partySize: 2 });

    expect(responseError.mock.calls[0][3]).toBe(400);
    expect(createReservation).not.toHaveBeenCalled();
  });

  it("rejects a slot that has already started", async () => {
    getTimeSlotById.mockResolvedValue(slotStartingIn(-60e3));
    await call({ timeSlotId: 1, partySize: 2 });

    expect(responseError).toHaveBeenCalled();
    expect(createReservation).not.toHaveBeenCalled();
  });
});

describe("reservationController.create - one reservation per time slot", () => {
  it("answers 409 when the hiker already has a reservation for that slot", async () => {
    getReservationsByUser.mockResolvedValue([{ reservId: 1 }]);
    await call({ timeSlotId: 1, partySize: 2 });

    expect(getReservationsByUser).toHaveBeenCalledWith(7, 1);
    expect(responseError.mock.calls[0][3]).toBe(409);
    expect(createReservation).not.toHaveBeenCalled();
  });

  it("books when the hiker has no reservation for that slot", async () => {
    getReservationsByUser.mockResolvedValue([]);
    await call({ timeSlotId: 1, partySize: 2 });

    expect(createReservation).toHaveBeenCalled();
  });
});

describe("reservationController.create - errors", () => {
  it("lets repository errors reach the error handler", async () => {
    createReservation.mockRejectedValue(new Error("Not enough free seats"));

    await expect(call({ timeSlotId: 1, partySize: 50 })).rejects.toThrow("Not enough free seats");
    expect(responseSuccess).not.toHaveBeenCalled();
  });
});