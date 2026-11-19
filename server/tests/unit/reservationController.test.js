import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../repositories/reservationRepository.js", () => ({
  createReservation: vi.fn(),
  getReservationById: vi.fn(),
  getReservationsByUser: vi.fn(),
  updateReservation: vi.fn(),
}));
vi.mock("../../repositories/timeSlotRepository.js", () => ({
  getTimeSlotById: vi.fn(),
}));
vi.mock("../../utils/response.js", () => ({ responseSuccess: vi.fn(), responseError: vi.fn() }));
vi.mock("../../services/smtpService.js", () => ({
	sendTemplateEmail: vi.fn(),
}));
vi.mock("../../utils/dateTimeFormatter.js", () => ({
  formatDateTime: vi.fn(),
}));

import {
  createReservation,
  getReservationById,
  getReservationsByUser,
  updateReservation,
} from "../../repositories/reservationRepository.js";
import { getTimeSlotById } from "../../repositories/timeSlotRepository.js";
import { responseSuccess, responseError } from "../../utils/response.js";
import reservationController from "../../controllers/reservationController.js";
import { formatDateTime } from "../../utils/dateTimeFormatter.js";
import { sendTemplateEmail } from "../../services/smtpService.js";

const NOW = new Date("2027-03-10T10:00:00Z");
const HOUR = 3600e3;
const res = {};
const SESSION_USER = { userId: 7, role: "HIKER", fullName: "Mario Rossi", email: "hiker@example.com" };
const callControllerCreate = (body, user = SESSION_USER) => reservationController.create({ user, body }, res);
const callControllerUpdate = (body, user = SESSION_USER, id = 42) => reservationController.update({ params: { id: String(id) }, user, body }, res);
const slotStartingIn = (ms) => ({ timeSlotId: 1, startDateTime: new Date(NOW.getTime() + ms), endDateTime: new Date(NOW.getTime() + 2 * ms) });
const updateBody = (overrides = {}) => ({ timeSlotId: 2, partySize: 6, dietaryRequirements: [], ...overrides });
const updateSlot = (ms, overrides = {}) => ({
  timeSlotId: 2,
  startDateTime: new Date(NOW.getTime() + ms),
  endDateTime: new Date(NOW.getTime() + ms + 2 * HOUR),
  freeSeats: 10,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  getTimeSlotById.mockResolvedValue(slotStartingIn(24 * HOUR));
  getReservationById.mockResolvedValue({
    reservId: 42,
    userId: SESSION_USER.userId,
    timeSlotId: 1,
    partySize: 4,
    startDateTime: new Date(NOW.getTime() + 72 * HOUR),
  });
  getReservationsByUser.mockResolvedValue([]);
  createReservation.mockResolvedValue(42);
  updateReservation.mockResolvedValue(42);
  sendTemplateEmail.mockResolvedValue(undefined);
  formatDateTime.mockReturnValue("formatted-date-string");
});
afterEach(() => vi.useRealTimers());

describe("reservationController.create - happy path", () => {
  it("books for the logged user, taking the id from the session, and answers 201", async () => {
    await callControllerCreate({ timeSlotId: 1, partySize: 4, dietaryRequirements: [] });

    expect(createReservation).toHaveBeenCalledWith(7, 1, 4, []);
    expect(responseSuccess).toHaveBeenCalledWith(res, 42, expect.any(String), 201);
  });

  it("passes dietary requirements", async () => {
	const dietaryReq = [{allergies: true, description: "No nuts"}];
    await callControllerCreate({ timeSlotId: 1, partySize: 4, dietaryRequirements: dietaryReq });

    expect(createReservation).toHaveBeenCalledWith(7, 1, 4, dietaryReq);
    expect(responseSuccess).toHaveBeenCalledWith(res, 42, expect.any(String), 201);
  });

  it("ignores a userId sent in the body (no booking on behalf of others)", async () => {
    await callControllerCreate({ timeSlotId: 1, partySize: 2, userId: 999, dietaryRequirements: [] });

    expect(createReservation).toHaveBeenCalledWith(7, 1, 2, []);
  });

});

describe("reservationController.create - input validation", () => {
  it("answers 404 for a time slot that does not exist (instead of crashing)", async () => {
    getTimeSlotById.mockResolvedValue(null);

    await callControllerCreate({ timeSlotId: 99, partySize: 2, dietaryRequirements: [] });

    expect(responseError.mock.calls[0][3]).toBe(404);
    expect(createReservation).not.toHaveBeenCalled();
  });

});

describe("reservationController.create - 2 hours rule", () => {
  it("accepts a reservation made exactly 2 hours before the slot", async () => {
    getTimeSlotById.mockResolvedValue(slotStartingIn(2 * HOUR));
    await callControllerCreate({ timeSlotId: 1, partySize: 2, dietaryRequirements: []});

    expect(createReservation).toHaveBeenCalled();
  });

  it("rejects a reservation made 1 minute too late", async () => {
    getTimeSlotById.mockResolvedValue(slotStartingIn(2 * HOUR - 60e3));
    await callControllerCreate({ timeSlotId: 1, partySize: 2, dietaryRequirements: [] });

    expect(responseError.mock.calls[0][3]).toBe(400);
    expect(createReservation).not.toHaveBeenCalled();
  });

  it("rejects a slot that has already started", async () => {
    getTimeSlotById.mockResolvedValue(slotStartingIn(-60e3));
    await callControllerCreate({ timeSlotId: 1, partySize: 2, dietaryRequirements: [] });

    expect(responseError).toHaveBeenCalled();
    expect(createReservation).not.toHaveBeenCalled();
  });
});

describe("reservationController.create - one reservation per time slot", () => {
  it("answers 409 when the hiker already has a reservation for that slot", async () => {
    getReservationsByUser.mockResolvedValue([{ reservId: 1 }]);
    await callControllerCreate({ timeSlotId: 1, partySize: 2, dietaryRequirements: [] });

    expect(getReservationsByUser).toHaveBeenCalledWith(7, 1);
    expect(responseError.mock.calls[0][3]).toBe(409);
    expect(createReservation).not.toHaveBeenCalled();
  });

  it("books when the hiker has no reservation for that slot", async () => {
    getReservationsByUser.mockResolvedValue([]);
    await callControllerCreate({ timeSlotId: 1, partySize: 2, dietaryRequirements: [] });

    expect(createReservation).toHaveBeenCalled();
  });
});

describe("reservationController.create - errors", () => {
  it("lets repository errors reach the error handler", async () => {
    createReservation.mockRejectedValue(new Error("Not enough free seats"));

    await expect(callControllerCreate({ timeSlotId: 1, partySize: 500, dietaryRequirements: [] })).rejects.toThrow("Not enough free seats");
    expect(responseSuccess).not.toHaveBeenCalled();
  });
});

describe("reservationController.create - email notification", () => {
  it.each([
	[[{allergies: true, description: "No nuts please" }], ["Yes", "No nuts please (Allergy)"]],
	[[{allergies: true, description: "No nuts please" }, { allergies: false, description: "I can't eat eggs"}], ["Yes", "No nuts please (Allergy), I can't eat eggs (Diet)"]],
	[[{allergies: false, description: "Carnivore" }, { allergies: false, description: "Vegetarian"}], ["No", "Carnivore (Diet), Vegetarian (Diet)"]],
	[[], ["No", "None"]],
  ]	
  )("sends a confirmation email with the correct template and data upon successful reservation", 
	async (dietaryReq, [expectedAllergies, expectedFormattedDietaryReq]) => {
    
    getTimeSlotById.mockResolvedValue(slotStartingIn(24 * HOUR));
    createReservation.mockResolvedValue(42);  
    
    formatDateTime
      .mockReturnValueOnce("10-03-2027 10:00") // startDateTime
      .mockReturnValueOnce("10-03-2027 12:00"); // endDateTime

    await callControllerCreate({ timeSlotId: 1, partySize: 4, dietaryRequirements: dietaryReq });
    
    expect(sendTemplateEmail).toHaveBeenCalledWith({
      to: "hiker@example.com",
      subject: "Reservation Confirmation",
      templateName: "reservation-confirmation",
      data: {
        user: {
          fullName: "Mario Rossi",
        },
        reservation: {
          reservId: 42,
          userId: 7,
          timeSlotId: 1,
          partySize: 4,
		  allergies: expectedAllergies,
		  dietaryRequirements: expectedFormattedDietaryReq,
        },
        timeSlot: {
          timeSlotId: 1,
          startDateTime: "10-03-2027 10:00",
          endDateTime: "10-03-2027 12:00",
        },
      },
      text: "Your reservation has been confirmed.",
    });
    
    expect(responseSuccess).toHaveBeenCalledWith(res, 42, expect.any(String), 201);
  });

  it("lets SMTP service errors reach the error handler without sending success response", async () => {
    
    sendTemplateEmail.mockRejectedValue(new Error("SMTP server down"));

    await expect(callControllerCreate({ timeSlotId: 1, partySize: 4, allergies: false, dietaryRequirements: [] })).rejects.toThrow("SMTP server down");
    
    expect(responseSuccess).not.toHaveBeenCalled();
  });
});

describe("reservationController.update - success", () => {
  it("updates the reservation and emails the owner with the updated details", async () => {
    const dietaryRequirements = [
      { description: "No nuts", allergies: true },
      { description: "Vegan", allergies: false },
    ];
    getTimeSlotById.mockResolvedValue(updateSlot(96 * HOUR));
    formatDateTime
      .mockReturnValueOnce("10-03-2027 10:00")
      .mockReturnValueOnce("10-03-2027 12:00");

    await callControllerUpdate(updateBody({ partySize: 6, dietaryRequirements }));

    expect(getReservationById).toHaveBeenCalledWith(42);
    expect(getTimeSlotById).toHaveBeenCalledWith(2);
    expect(getReservationsByUser).toHaveBeenCalledWith(7, 2);
    expect(updateReservation).toHaveBeenCalledWith(42, 2, 6, dietaryRequirements);
    expect(sendTemplateEmail).toHaveBeenCalledWith({
      to: "hiker@example.com",
      subject: "Reservation Updated",
      templateName: "reservation-update",
      data: {
        user: { fullName: "Mario Rossi" },
        reservation: {
          reservId: 42,
          userId: 7,
          timeSlotId: 2,
          partySize: 6,
          allergies: "Yes",
          dietaryRequirements: "No nuts (Allergy), Vegan (Diet)",
        },
        timeSlot: {
          timeSlotId: 2,
          startDateTime: "10-03-2027 10:00",
          endDateTime: "10-03-2027 12:00",
        },
      },
      text: "Your reservation has been updated.",
    });
    expect(responseSuccess).toHaveBeenCalledWith(res, null, "Reservation successfully updated");
  });
});

describe("reservationController.update - validation", () => {
  it("returns 404 when the reservation does not exist", async () => {
    getReservationById.mockResolvedValue(null);

    await callControllerUpdate(updateBody());

    expect(responseError).toHaveBeenCalledWith(res, null, "Reservation 42 not found", 404);
    expect(getTimeSlotById).not.toHaveBeenCalled();
    expect(updateReservation).not.toHaveBeenCalled();
  });

  it("returns 403 when the reservation belongs to another user", async () => {
    getReservationById.mockResolvedValue({ userId: 99 });

    await callControllerUpdate(updateBody());

    expect(responseError).toHaveBeenCalledWith(res, null, "You cannot update another user's reservation", 403);
    expect(getTimeSlotById).not.toHaveBeenCalled();
    expect(updateReservation).not.toHaveBeenCalled();
  });

  it("returns 404 when the requested time slot does not exist", async () => {
    getTimeSlotById.mockResolvedValue(null);

    await callControllerUpdate(updateBody());

    expect(responseError).toHaveBeenCalledWith(res, null, "Time slot with timeSlotId=2 not found", 404);
    expect(getReservationsByUser).not.toHaveBeenCalled();
    expect(updateReservation).not.toHaveBeenCalled();
  });

  it("rejects a new time slot less than two hours away", async () => {
    getTimeSlotById.mockResolvedValue(updateSlot(2 * HOUR - 1));

    await callControllerUpdate(updateBody());

    expect(responseError).toHaveBeenCalledWith(
      res,
      null,
      "Reservation has to be updated at least 2 hours before the new slot.",
      400,
    );
    expect(updateReservation).not.toHaveBeenCalled();
  });

  it("rejects an update less than 48 hours before the original slot", async () => {
    getReservationById.mockResolvedValue({
      reservId: 42,
      userId: SESSION_USER.userId,
      startDateTime: new Date(NOW.getTime() + 48 * HOUR - 1),
    });

    await callControllerUpdate(updateBody());

    expect(responseError).toHaveBeenCalledWith(
      res,
      null,
      "Reservation has to be updated at least 48 hours before the slot.",
      400,
    );
    expect(getReservationsByUser).not.toHaveBeenCalled();
    expect(updateReservation).not.toHaveBeenCalled();
  });

  it("rejects a time slot already reserved by the same user", async () => {
    getReservationsByUser.mockResolvedValue([{ reservId: 42 }, { reservId: 43 }]);

    await callControllerUpdate(updateBody());

    expect(responseError).toHaveBeenCalledWith(res, null, "Reservation for that time slot already exists", 409);
    expect(updateReservation).not.toHaveBeenCalled();
  });

  it("counts the reservation's current seats when keeping its time slot", async () => {
    getReservationById.mockResolvedValue({
      reservId: 42,
      userId: SESSION_USER.userId,
      timeSlotId: 2,
      partySize: 4,
      startDateTime: new Date(NOW.getTime() + 72 * HOUR),
    });
    getReservationsByUser.mockResolvedValue([{ reservId: 42 }]);
    getTimeSlotById.mockResolvedValue(updateSlot(96 * HOUR, { freeSeats: 0 }));

    await callControllerUpdate(updateBody({ timeSlotId: 2, partySize: 4 }));

    expect(updateReservation).toHaveBeenCalledWith(42, 2, 4, []);
    expect(responseSuccess).toHaveBeenCalled();
    expect(responseError).not.toHaveBeenCalled();
  });

  it("rejects a party larger than the available seats", async () => {
    getTimeSlotById.mockResolvedValue(updateSlot(96 * HOUR, { freeSeats: 5 }));

    await callControllerUpdate(updateBody({ partySize: 6 }));

    expect(responseError).toHaveBeenCalledWith(res, null, "Not enough free seats", 400);
    expect(updateReservation).not.toHaveBeenCalled();
  });

  it("accepts updates exactly two hours before the new slot and 48 hours before the original slot", async () => {
    getReservationById.mockResolvedValue({
      reservId: 42,
      userId: SESSION_USER.userId,
      timeSlotId: 2,
      partySize: 4,
      startDateTime: new Date(NOW.getTime() + 48 * HOUR),
    });
    getReservationsByUser.mockResolvedValue([{ reservId: 42 }]);
    getTimeSlotById.mockResolvedValue(updateSlot(2 * HOUR, { freeSeats: 4 }));

    await callControllerUpdate(updateBody({ timeSlotId: 2, partySize: 4 }));

    expect(updateReservation).toHaveBeenCalledWith(42, 2, 4, []);
    expect(responseSuccess).toHaveBeenCalled();
    expect(responseError).not.toHaveBeenCalled();
  });
});

describe("reservationController.update - repository errors", () => {
  it("maps the repository's insufficient-seat error to a 400 response", async () => {
    getTimeSlotById.mockResolvedValue(updateSlot(96 * HOUR));
    updateReservation.mockRejectedValue(new Error("Not enough free seats to change the reservation"));

    await callControllerUpdate(updateBody());

    expect(responseError).toHaveBeenCalledWith(res, null, "Not enough free seats", 400);
    expect(responseSuccess).not.toHaveBeenCalled();
    expect(sendTemplateEmail).not.toHaveBeenCalled();
  });

  it("propagates other repository errors", async () => {
    getTimeSlotById.mockResolvedValue(updateSlot(96 * HOUR));
    updateReservation.mockRejectedValue(new Error("database unavailable"));

    await expect(callControllerUpdate(updateBody())).rejects.toThrow("database unavailable");
    expect(responseSuccess).not.toHaveBeenCalled();
    expect(sendTemplateEmail).not.toHaveBeenCalled();
  });
});
