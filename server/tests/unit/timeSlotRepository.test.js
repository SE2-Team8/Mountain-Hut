import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../utils/query.js", () => ({
  queryAll: vi.fn(),
  queryGet: vi.fn(),
  queryRun: vi.fn(),
  withTransaction: vi.fn((fn) => fn()),
}));

import { queryAll, queryGet, queryRun } from "../../utils/query.js";
import { getAllTimeSlots, getTimeSlotByStart, getTimeSlotById, createTimeSlot } from "../../repositories/timeSlotRepository.js";
import { stringISOToDate } from "../../utils/dateTimeFormatter.js";

const rows = [
  { timeSlotId: 1, startDateTime: "2027-03-10T12:30:00Z", endDateTime: "2027-03-10T14:30:00Z", freeSeats: 20 },
  { timeSlotId: 2, startDateTime: "2027-03-10T18:30:00Z", endDateTime: "2027-03-10T19:30:00Z", freeSeats: 5 },
  { timeSlotId: 3, startDateTime: "2027-03-11T12:00:00Z", endDateTime: "2027-03-11T14:00:00Z", freeSeats: null },
];

const tableList = [
	{ tableNumber: 1, totalSeats: 2 },
	{ tableNumber: 2, totalSeats: 17 },
	{ tableNumber: 4, totalSeats: 3 },
];

const writes = (fragment) =>
  queryRun.mock.calls.filter(([sql]) => sql.includes(fragment));

const createdTables = () =>
  writes("INSERT INTO tables")
    .map(([, [tableNumber, totalSeats, freeSeats, timeSlotId]]) => 
		({ tableNumber, totalSeats, freeSeats, timeSlotId }));

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

describe("getTimeSlotById", () => {
  it("only uses columns that exist in the schema", async () => {
    queryGet.mockResolvedValue(rows[0]);
    await getTimeSlotById(1);

    expect(queryGet.mock.calls[0][0]).not.toMatch(/occupiedSeats/);
  });

  it("returns the slot with Date objects", async () => {
    queryGet.mockResolvedValue(rows[0]);
    const slot = await getTimeSlotById(1);

    expect(slot.timeSlotId).toBe(1);
    expect(slot.startDateTime).toBeInstanceOf(Date);
  });

  it("returns null when the slot does not exist", async () => {
    queryGet.mockResolvedValue(undefined);
    expect(await getTimeSlotById(99)).toBeNull();
  });
});

describe("createTimeSlot", () => {
  it("error when table args are null", async () => {
    await expect(createTimeSlot(null, null)).rejects.toThrow();
  });

  it("error when dateTimes are not js dates", async () => {
    queryRun.mockResolvedValue({ lastID: 42 });
	await expect(createTimeSlot(new Date(), 12, tableList, null)).rejects.toThrow();

	await expect(createTimeSlot(1.75, new Date(), tableList, null)).rejects.toThrow();
  });

  it("error when start dateTime already exists", async () => {
    queryGet.mockResolvedValue(rows[0]); // TODO: verify this is used as thought
	const startDateTime = stringISOToDate(rows[0].startDateTime);
	const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // plus 1h
	await expect(createTimeSlot(
		startDateTime,
		endDateTime,
		tableList, null)
	).rejects.toThrow();
  });

  it("error when start dateTime is after end dateTime", async () => {
	const startDateTime = stringISOToDate(rows[0].startDateTime);
	const endDateTime = new Date(startDateTime.getTime() - 60 * 60 * 1000); // minus 1h
	await expect(createTimeSlot(
		startDateTime,
		endDateTime,
		tableList, null)
	).rejects.toThrow();
  });

  it("error when start dateTime is equal to end dateTime", async () => {
	const startDateTime = stringISOToDate(rows[0].startDateTime);
	const endDateTime = startDateTime;
	await expect(createTimeSlot(
		startDateTime,
		endDateTime,
		tableList, null)
	).rejects.toThrow();
  });

  it("error when tableList is empty", async () => {
	const startDateTime = stringISOToDate(rows[0].startDateTime);
	const endDateTime = stringISOToDate(rows[0].endDateTime);
	await expect(createTimeSlot(startDateTime, endDateTime, [], null)
	).rejects.toThrow();
  });

  it("error when tables have invalid seats", async () => {
	const startDateTime = stringISOToDate(rows[0].startDateTime);
	const endDateTime = stringISOToDate(rows[0].endDateTime);
	await expect(createTimeSlot(
		startDateTime, endDateTime,
		[{ tableNumber: 1, totalSeats: -5}], null)
	).rejects.toThrow();

	await expect(createTimeSlot(
		startDateTime, endDateTime,
		[{ tableNumber: 1, totalSeats: 0}], null)
	).rejects.toThrow();

	await expect(createTimeSlot(
		startDateTime, endDateTime,
		[{ tableNumber: 1, totalSeats: 1.5}], null)
	).rejects.toThrow();
  });

   it("error when table number is not unique", async () => {
	const startDateTime = stringISOToDate(rows[0].startDateTime);
	const endDateTime = stringISOToDate(rows[0].endDateTime);

	// add a duplicate table number to the list
	let tList = [...tableList];
	tList.push(tList[0]);

	await expect(createTimeSlot(startDateTime, endDateTime, tableList, null)).rejects.toThrow();
  });

  it("error when copying from non existing timeslot", async () => {
	const startDateTime = stringISOToDate(rows[0].startDateTime);
	const endDateTime = stringISOToDate(rows[0].endDateTime);

	await expect(createTimeSlot(
		startDateTime, endDateTime,
		null, 1234567)
	).rejects.toThrow();

  });

  it("error when copying table from self timeSlot", async () => {
	queryRun.mockResolvedValue({ lastID: 42 });
	const startDateTime = stringISOToDate(rows[0].startDateTime);
	const endDateTime = stringISOToDate(rows[0].endDateTime);

	await expect(createTimeSlot(
		startDateTime, endDateTime,
		null, 42)
	).rejects.toThrow();

  });

  it("slotId is correct", async () => {
    queryRun.mockResolvedValue({ lastID: 42 });
    let slotId = await createTimeSlot(
		stringISOToDate("2027-03-11T12:00:00Z"),
		stringISOToDate("2027-03-12T12:00:00Z"),
		tableList, null);

    expect(slotId).toBe(42);
  });

  it("created tables are correct when passing table list", async () => {
	queryRun.mockResolvedValue({ lastID: 42 });
    await createTimeSlot(
		stringISOToDate("2027-03-11T12:00:00Z"),
		stringISOToDate("2027-03-12T12:00:00Z"),
		tableList, null);

	let expectedTables = [...tableList];
	expectedTables.forEach((table) => {
		table.freeSeats = table.totalSeats;
		table.timeSlotId = 42;
	});

     expect(createdTables()).toEqual(expectedTables);
  });

  it("created tables are correct when copying from timeSlot", async () => {
	queryRun.mockResolvedValue({ lastID: 42 });
	queryAll.mockResolvedValue(tableList);
    await createTimeSlot(
		stringISOToDate("2027-03-11T12:00:00Z"),
		stringISOToDate("2027-03-12T12:00:00Z"),
		null, 12);

	let expectedTables = [...tableList];
	expectedTables.forEach((table) => {
		table.freeSeats = table.totalSeats;
		table.timeSlotId = 42;
	});

    expect(createdTables()).toEqual(expectedTables);
  });

  // TODO tests: transaction stuff, correct dates placed
});