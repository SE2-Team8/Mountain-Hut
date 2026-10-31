import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../utils/query.js", () => ({ queryAll: vi.fn(), queryGet: vi.fn() }));

import { queryAll, queryGet } from "../../utils/query.js";
import { getAllTimeSlots, getTimeSlotByStart } from "../../repositories/timeSlotRepository.js";

const rows = [
  { timeSlotId: 1, startDateTime: "2027-03-10T12:30:00Z", endDateTime: "2027-03-10T14:30:00Z", freeSeats: 20 },
  { timeSlotId: 2, startDateTime: "2027-03-10T18:30:00Z", endDateTime: "2027-03-10T19:30:00Z", freeSeats: 5 },
  { timeSlotId: 3, startDateTime: "2027-03-11T12:00:00Z", endDateTime: "2027-03-11T14:00:00Z", freeSeats: null },
];

beforeEach(() => vi.clearAllMocks());

describe("getAllTimeSlots", () => {
  beforeEach(() => queryAll.mockResolvedValue(rows));

  it("only uses columns that exist in the schema (tables has freeSeats, not occupiedSeats)", async () => {
    await getAllTimeSlots();
    expect(queryAll.mock.calls[0][0]).not.toMatch(/occupiedSeats/);
  });

  it("returns 0 free seats for a slot without tables", async () => {
    const slots = await getAllTimeSlots();
    expect(slots.find((s) => s.timeSlotId === 3).freeSeats).toBe(0);
  });

  it("filters by 'from'", async () => {
    const slots = await getAllTimeSlots(new Date("2027-03-10T18:00:00Z"));
    expect(slots.map((s) => s.timeSlotId)).toEqual([2, 3]);
  });

  it("filters by 'to'", async () => {
    const slots = await getAllTimeSlots(null, new Date("2027-03-10T18:30:00Z"));
    expect(slots.map((s) => s.timeSlotId)).toEqual([1, 2]);
  });

  it("filters by a day range", async () => {
    const slots = await getAllTimeSlots(new Date("2027-03-10T00:00:00Z"), new Date("2027-03-10T23:59:59Z"));
    expect(slots.map((s) => s.timeSlotId)).toEqual([1, 2]);
  });
});

describe("getTimeSlotByStart", () => {
  it("only uses columns that exist in the schema", async () => {
    queryGet.mockResolvedValue(rows[0]);
    await getTimeSlotByStart(new Date("2027-03-10T12:30:00Z"));

    expect(queryGet.mock.calls[0][0]).not.toMatch(/occupiedSeats/);
  });

  it("returns the slot found", async () => {
    queryGet.mockResolvedValue(rows[0]);
    const slot = await getTimeSlotByStart(new Date("2027-03-10T12:30:00Z"));

    expect(slot.timeSlotId).toBe(1);
    expect(queryGet.mock.calls[0][1]).toEqual(["2027-03-10T12:30:00Z"]);
  });

  it("returns null when the slot does not exist", async () => {
    queryGet.mockResolvedValue(undefined);
    expect(await getTimeSlotByStart(new Date("2027-03-10T12:30:00Z"))).toBeNull();
  });
});