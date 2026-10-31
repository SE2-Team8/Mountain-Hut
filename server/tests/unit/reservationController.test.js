import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../repositories/reservationRepository.js", () => ({
  createReservation: vi.fn(),
  hasReservationInSlot: vi.fn(),
}));
vi.mock("../../utils/response.js", () => ({ responseSuccess: vi.fn(), responseError: vi.fn() }));
vi.mock("../../repositories/timeSlotRepository.js", () => ({ getTimeSlotById: vi.fn() }));

import { createReservation } from "../../repositories/reservationRepository.js";
import { responseSuccess, responseError } from "../../utils/response.js";
import reservationController from "../../controllers/reservationController.js";

const res = {};
const SESSION_USER = { userId: 7, role: "HIKER" };
const call = (body, user = SESSION_USER) => reservationController.create({ user, body }, res);

beforeEach(() => vi.clearAllMocks());

describe("reservationController.create - story 1 rules", () => {
  const NOW = new Date("2027-03-10T10:00:00Z");
  const HOUR = 3600e3;
  const slotStartingIn = (ms) => ({
    timeSlotId: 1,
    startDateTime: new Date(NOW.getTime() + ms),
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    hasReservationInSlot.mockResolvedValue(false);
    createReservation.mockResolvedValue(42);
  });
  afterEach(() => vi.useRealTimers());

  it("accepts a reservation exactly 2 hours before the slot", async () => {
    getTimeSlotById.mockResolvedValue(slotStartingIn(2 * HOUR));
    await call({ timeSlotId: 1, partySize: 2 });
    expect(createReservation).toHaveBeenCalled();
  });

  it("rejects a reservation less than 2 hours before the slot", async () => {
    getTimeSlotById.mockResolvedValue(slotStartingIn(2 * HOUR - 60e3));
    await call({ timeSlotId: 1, partySize: 2 });

    expect(responseError.mock.calls[0][3]).toBe(409); // o 400: da concordare
    expect(createReservation).not.toHaveBeenCalled();
  });

  it("rejects a slot that has already started", async () => {
    getTimeSlotById.mockResolvedValue(slotStartingIn(-60e3));
    await call({ timeSlotId: 1, partySize: 2 });

    expect(createReservation).not.toHaveBeenCalled();
  });

  it("rejects a second reservation of the same hiker in the same slot", async () => {
    getTimeSlotById.mockResolvedValue(slotStartingIn(24 * HOUR));
    hasReservationInSlot.mockResolvedValue(true);
    await call({ timeSlotId: 1, partySize: 2 });

    expect(hasReservationInSlot).toHaveBeenCalledWith(7, 1);
    expect(createReservation).not.toHaveBeenCalled();
  });
});

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