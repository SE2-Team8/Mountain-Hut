import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../repositories/timeSlotRepository.js", () => ({
  getAllTimeSlots: vi.fn(),
  getTimeSlotByStart: vi.fn(),
  getTimeSlotById: vi.fn(),
  createTimeSlot: vi.fn(),
    TimeSlot: vi.fn(function (timeSlotId, startDateTime, endDateTime, freeSeats) {
    this.timeSlotId = timeSlotId;
    this.startDateTime = startDateTime;
    this.endDateTime = endDateTime;
    this.freeSeats = freeSeats ? freeSeats : 0;
  })
}));
vi.mock("../../utils/response.js", () => ({ responseSuccess: vi.fn(), responseError: vi.fn() }));

import { createTimeSlot, getTimeSlotById, getTimeSlotByStart, TimeSlot } from "../../repositories/timeSlotRepository.js";
import { responseError, responseSuccess } from "../../utils/response.js";
import timeSlotController from "../../controllers/timeSlotController.js";

beforeEach(() => vi.clearAllMocks());

describe("timeSlotController.getByStart", () => {
  it("answers 404 when the time slot does not exist", async () => {
    getTimeSlotByStart.mockResolvedValue(null);
    await timeSlotController.getByStart({ params: { start: "2027-03-10T12:30:00Z" } }, {});

    expect(responseError.mock.calls[0][3]).toBe(404);
    expect(responseSuccess).not.toHaveBeenCalled();
  });
});


// TODO tests: move some from repository
describe("timeSlotController.create", () => {

  it("error when start dateTime already exists", async () => {
	getTimeSlotByStart.mockResolvedValue(new TimeSlot(
		42,
		"2027-03-10T12:30:00Z",
		"2027-03-10T13:30:00Z",
		1
	));

	const body = {
		startDateTime: "2027-03-10T12:30:00Z",
		endDateTime: "2027-03-10T14:30:00Z",
		tables: [
			{tableNumber: 1, totalSeats: 5},
			{tableNumber: 2, totalSeats: 7},
			{tableNumber: 3, totalSeats: 6}
		]
	};

	await timeSlotController.create({ body: body }, {});

	expect(responseError.mock.calls[0][3]).toBe(409);
	expect(createTimeSlot).toHaveBeenCalledTimes(0);
  });

  it("error when copying from non existing timeslot", async () => {
	getTimeSlotById.mockResolvedValue(null);
	getTimeSlotByStart.mockResolvedValue(null);

	const body = {
		startDateTime: "2027-03-10T12:30:00Z",
		endDateTime: "2027-03-10T14:30:00Z",
		copyFromTimeSlotId: 2
	};

	await timeSlotController.create({ body: body }, {});

	expect(responseError.mock.calls[0][3]).toBe(404);
	expect(createTimeSlot).toHaveBeenCalledTimes(0);
  });

  it("correct slot id returned", async () => {
	getTimeSlotById.mockResolvedValue(2);
	getTimeSlotByStart.mockResolvedValue(null);

	const body = {
		startDateTime: "2027-03-10T12:30:00Z",
		endDateTime: "2027-03-10T14:30:00Z",
		copyFromTimeSlotId: 2
	};

	await timeSlotController.create({ body: body }, {});

	expect(createTimeSlot).toHaveBeenCalledTimes(1);
	expect(responseSuccess.mock.calls[0][3]).toBe(201);
  });

});