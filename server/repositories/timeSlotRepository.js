import { queryAll, queryGet, queryRun, withTransaction } from "../utils/query.js";
import { dateToStringISO, stringISOToDate } from "../utils/dateTimeFormatter.js";
import { getAvailableTables } from "./reservationRepository.js";

function TimeSlot(timeSlotId, startDateTime, endDateTime, freeSeats) {
	this.timeSlotId = timeSlotId
	this.startDateTime = startDateTime;
	this.endDateTime = endDateTime;
	this.freeSeats = freeSeats? freeSeats : 0 // if null, no free seats;
}

// returns the timeslot with the given id, or null if not found
async function getTimeSlotById(timeSlotId) {
    const row = await queryGet(
		`SELECT timeSlots.*, SUM(freeSeats) as freeSeats
		FROM timeSlots NATURAL LEFT OUTER JOIN tables
		WHERE timeSlots.timeSlotId = ?`,
		[timeSlotId]);

    if (!row || row.timeSlotId == null) return null;

    return new TimeSlot(
		row.timeSlotId,
		stringISOToDate(row.startDateTime),
		stringISOToDate(row.endDateTime),
		row.freeSeats
	);
}

// returns the timeslot that starts at the given dateTime, or null if not found
async function getTimeSlotByStart(startDateTime) {
	const dateTimeString = dateToStringISO(startDateTime);
    const slotRow = await queryGet(
		`SELECT timeSlots.*, SUM(freeSeats) as freeSeats
		FROM timeSlots NATURAL LEFT OUTER JOIN tables
		WHERE startDateTime = ?`,
		[dateTimeString]);

    if (!slotRow || slotRow.timeSlotId == null) return null;

    return new TimeSlot(
		slotRow.timeSlotId,
		stringISOToDate(slotRow.startDateTime),
		stringISOToDate(slotRow.endDateTime),
		slotRow.freeSeats
	);
}

// returns all the timeslots. This method can also filter on a given dateTime range (both extremes included)
async function getAllTimeSlots(from = null, to = null) {
    const slotRows = await queryAll(
		`SELECT timeSlots.timeSlotId, startDateTime, endDateTime,
		SUM(freeSeats) AS freeSeats
		FROM timeSlots NATURAL LEFT OUTER JOIN tables
		GROUP BY timeSlots.timeSlotId`);

    let slots = slotRows.map((slotRow) => new TimeSlot(
		slotRow.timeSlotId,
		stringISOToDate(slotRow.startDateTime),
		stringISOToDate(slotRow.endDateTime),
		slotRow.freeSeats
	));

	// filter to dateTime range
	if (from) {
        const fromDate = from instanceof Date ? from : new Date(from);
        slots = slots.filter((slot) => slot.startDateTime.getTime() >= fromDate.getTime());
    }
    if (to) {
        const toDate = to instanceof Date ? to : new Date(to);
        slots = slots.filter((slot) => slot.startDateTime.getTime() <= toDate.getTime());
    }

	return slots;
}

// checks if a party of a given size could be seated in the timeslot, without creating anything.
// returns null if the time slot does not exist, otherwise
// { available, freeSeats, tables: [{ tableNumber, seatsToTake }] } 
// tables sorted by table number, and empty when the party cannot be seated
async function checkSlotAvailability(timeSlotId, partySize) {
	const slot = await getTimeSlotById(timeSlotId);
	if (!slot) return null;

	const selected = await getAvailableTables(timeSlotId, partySize);
	if (selected.length === 0)
		return { available: false, freeSeats: 0, tables: [] }

	return {
		available: true,
		freeSeats: slot.freeSeats,
		tables: selected.map((t) => ({
			tableNumber: t.tableNumber,
			seatsToTake: t.seatsToTake, 
		})).sort((a, b) => a.tableNumber - b.tableNumber)
	}
}

// this function create a new time slot, with the set of tables
// for the set of table we have two options:
// 1. we give in input a list of tables like [{ tableNumber: 1, totalSeats: 10 }, { tableNumber: 2, totalSeats: 5 }]
// 2. we give in input a timeSlotId from which we will copy the table set
// be aware that both inputs cannot be null together
// and if they are bot not null, the timeSlotIdCopy will be used, not the tableList
async function createTimeSlot(from, to, tableList = null, timeSlotIdCopy = null){
	return await withTransaction(async () => {
		if (!tableList && !timeSlotIdCopy) throw new Error("Both tableList or timeSLotIdCopy cannot be empty together");

		const queryRes = await queryRun(
			`INSERT INTO timeSlots
			(startDateTime, endDateTime) VALUES (?, ?)`,
			[dateToStringISO(from), dateToStringISO(to)]
		);
		const timeSlotId = queryRes.lastID;

		const copy = timeSlotIdCopy == null ? false : true
		if (copy){
				const tablesList = await queryAll(
				`SELECT tableId, tableNumber, totalSeats
				FROM tables
				WHERE timeSlotId = ?`,
				[timeSlotIdCopy]
        	);

			for (const {tableNumber, totalSeats} of tablesList){
				await queryRun(
					`INSERT INTO tables
					(tableNumber, totalSeats, freeSeats, timeSlotId) VALUES (?, ?, ?, ?)`,
					[tableNumber, totalSeats, totalSeats, timeSlotId]
				);
			}
		} else{
			for (const {tableNumber, totalSeats} of tableList){
				await queryRun(
					`INSERT INTO tables
					(tableNumber, totalSeats, freeSeats, timeSlotId) VALUES (?, ?, ?, ?)`,
					[tableNumber, totalSeats, totalSeats, timeSlotId]
				);
			}
		}
		return timeSlotId;
	});
}

// TODO (later): deleteTimeSlot, updateTimeSlot

export { TimeSlot, getTimeSlotById, getTimeSlotByStart, getAllTimeSlots, checkSlotAvailability, createTimeSlot };