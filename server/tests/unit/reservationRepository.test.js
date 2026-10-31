import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../utils/query.js", () => ({
  queryAll: vi.fn(),
  queryGet: vi.fn(),
  queryRun: vi.fn(),
  withTransaction: vi.fn((fn) => fn()),
}));

import { queryAll, queryGet, queryRun } from "../../utils/query.js";
import { createReservation } from "../../repositories/reservationRepository.js";

const TIME_SLOT_ID = 10;
const USER_ID = 1;

const table = (tableId, freeSeats) => ({
    tableId, tableNumber: tableId, totalSeats: freeSeats, freeSeats
});

// mimics the SQL "ORDER BY freeSeats ASC"
const givenFreeTables = (...tables) =>
  queryAll.mockResolvedValue([...tables].sort((a, b) => a.freeSeats - b.freeSeats));

const writes = (fragment) =>
  queryRun.mock.calls.filter(([sql]) => sql.includes(fragment));

const seatUpdates = () =>
  writes("UPDATE tables").map(([, [seats, id]]) => ({ id, seats }));

const assignments = () =>
  writes("INSERT INTO tableAssignments")
    .map(([, [tableId, reservId, seats]]) => ({ tableId, reservId, seats }));

beforeEach(() => {
  vi.clearAllMocks();
  queryRun.mockResolvedValue({ lastID: 42 });
  queryGet.mockResolvedValue(undefined);
});

describe("createReservation - single table", () => {
  it("uses the table whose free seats exactly match the party", async () => {
    givenFreeTables(table(1, 8), table(2, 4), table(3, 6));
    await createReservation(TIME_SLOT_ID, USER_ID, 4);

    expect(assignments()).toEqual([{ tableId: 2, reservId: 42, seats: 4 }]);
  });

  it("picks the smallest table that is large enough", async () => {
    givenFreeTables(table(1, 2), table(2, 5), table(3, 8));
    await createReservation(TIME_SLOT_ID, USER_ID, 3);

    expect(assignments()).toEqual([{ tableId: 2, reservId: 42, seats: 3 }]);
    expect(seatUpdates()).toEqual([{ id: 2, seats: 3 }]);
  });

  it("shares a partially occupied table with other parties", async () => {
    // table 1 has only 6 free seats left: the party of 2 sits there
    givenFreeTables(table(1, 6));
    await createReservation(TIME_SLOT_ID, USER_ID, 2);

    expect(assignments()).toEqual([{ tableId: 1, reservId: 42, seats: 2 }]);
  });

  it("works with a party of 1", async () => {
    givenFreeTables(table(1, 1), table(2, 4));
    await createReservation(TIME_SLOT_ID, USER_ID, 1);

    expect(assignments()).toEqual([{ tableId: 1, reservId: 42, seats: 1 }]);
  });
});

describe("createReservation - split over more tables", () => {
  it("splits only when no single table is large enough", async () => {
    givenFreeTables(table(1, 3), table(2, 4));
    await createReservation(TIME_SLOT_ID, USER_ID, 6);

    expect(assignments()).toHaveLength(2);
  });

  it("starts from the largest table to use as few tables as possible", async () => {
    givenFreeTables(table(1, 2), table(2, 2), table(3, 3), table(4, 4));
    await createReservation(TIME_SLOT_ID, USER_ID, 7);

    // 4 + 3 = 7 -> two tables, not four
    expect(assignments()).toEqual([
      { tableId: 4, reservId: 42, seats: 4 },
      { tableId: 3, reservId: 42, seats: 3 },
    ]);
  });

  it("uses the smallest suitable table for the remaining people", async () => {
    givenFreeTables(table(1, 3), table(2, 4));
    await createReservation(TIME_SLOT_ID, USER_ID, 6);

    // largest (4) first, then 2 people go to the table with 3 free seats
    expect(assignments()).toEqual([
      { tableId: 2, reservId: 42, seats: 4 },
      { tableId: 1, reservId: 42, seats: 2 },
    ]);
  });

  it("can take every remaining seat (party == total free seats)", async () => {
    givenFreeTables(table(1, 2), table(2, 3));
    await createReservation(TIME_SLOT_ID, USER_ID, 5);

    expect(seatUpdates().reduce((s, u) => s + u.seats, 0)).toBe(5);
  });

  it.each([
    [[4, 6, 8], 5], [[1, 1, 1, 1], 4], [[3, 3, 3], 7], [[10], 10], [[2, 5], 6],
  ])("assigned seats always sum to the party size (tables %j, party %i)", async (seats, party) => {
    givenFreeTables(...seats.map((s, i) => table(i + 1, s)));
    await createReservation(TIME_SLOT_ID, USER_ID, party);

    expect(assignments().reduce((s, a) => s + a.seats, 0)).toBe(party);
    seatUpdates().forEach((u) => expect(u.seats).toBeGreaterThan(0));
  });
});

describe("createReservation - results and persistence", () => {
  it("inserts the reservation and returns its id", async () => {
    givenFreeTables(table(1, 4));
    const id = await createReservation(TIME_SLOT_ID, USER_ID, 3);

    expect(id).toBe(42);
    expect(writes("INSERT INTO reservations")[0][1]).toEqual([USER_ID, TIME_SLOT_ID, 3]);
  });

  it("only queries tables of the requested time slot", async () => {
    givenFreeTables(table(1, 4));
    await createReservation(TIME_SLOT_ID, USER_ID, 3);

    expect(queryAll.mock.calls[0][1]).toEqual([TIME_SLOT_ID]);
  });

  it("waits for every write before resolving (the transaction must not close early)", async () => {
    let completed = 0;
    queryRun.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 5));
      completed++;
      return { lastID: 42 };
    });
    givenFreeTables(table(1, 3), table(2, 4));
    await createReservation(TIME_SLOT_ID, USER_ID, 6);

    expect(completed).toBe(queryRun.mock.calls.length);
  });
});

describe("createReservation - errors", () => {
  it("rejects when there are fewer free seats than the party, without writing anything", async () => {
    givenFreeTables(table(1, 2), table(2, 3));

    await expect(createReservation(TIME_SLOT_ID, USER_ID, 6)).rejects.toThrow(/not enough/i);
    expect(queryRun).not.toHaveBeenCalled();
    });

  it("rejects when no table has free seats", async () => {
    queryAll.mockResolvedValue([]);

    await expect(createReservation(TIME_SLOT_ID, USER_ID, 1)).rejects.toThrow();
    expect(queryRun).not.toHaveBeenCalled();
  });

  it("propagates database errors", async () => {
    queryAll.mockRejectedValue(new Error("db down"));

    await expect(createReservation(TIME_SLOT_ID, USER_ID, 2)).rejects.toThrow("db down");
  });
});

it.todo("signals 'not enough seats' with a client error status (e.g. 409) instead of a 500");