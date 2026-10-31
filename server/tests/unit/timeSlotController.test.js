import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../repositories/timeSlotRepository.js", () => ({
  getAllTimeSlots: vi.fn(),
  getTimeSlotByStart: vi.fn(),
}));
vi.mock("../../utils/response.js", () => ({ responseSuccess: vi.fn(), responseError: vi.fn() }));

import { getTimeSlotByStart } from "../../repositories/timeSlotRepository.js";
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