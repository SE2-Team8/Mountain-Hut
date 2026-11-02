import { queryAll, queryGet } from "../utils/query.js";
import { dateToStringISO, stringISOToDate } from "../utils/dateTimeFormatter.js";

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

// TODO: createTimeSlot
// TODO: copy table set configuration from 1 slot to another
// TODO (later): deleteTimeSlot, updateTimeSlot

export { TimeSlot, getTimeSlotById, getTimeSlotByStart, getAllTimeSlots };