import { queryAll, queryGet } from "../utils/query.js";
import { dateToStringISO, stringISOToDate } from "../utils/dateTimeFormatter.js";

function TimeSlot(timeSlotId, startDateTime, endDateTime, freeSeats) {
	this.timeSlotId = timeSlotId
	this.startDateTime = startDateTime;
	this.endDateTime = endDateTime;
	this.freeSeats = freeSeats? freeSeats : 0 // if null, no free seats;
}

async function getTimeSlotByStart(startDateTime) {
	const dateTimeString = dateToStringISO(startDateTime);
    const slotRow = await queryGet(
		`SELECT timeSlots.*, SUM(totalSeats - occupiedSeats) as freeSeats
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

async function getAllTimeSlots(from = null, to = null) {
    const slotRows = await queryAll(
		`SELECT timeSlots.timeSlotId, startDateTime, endDateTime,
		SUM(totalSeats - occupiedSeats) AS freeSeats
		FROM timeSlots NATURAL LEFT OUTER JOIN tables
		GROUP BY timeSlots.timeSlotId`);

    let slots = slotRows.map((slotRow) => new TimeSlot(
		slotRow.timeSlotId,
		stringISOToDate(slotRow.startDateTime),
		stringISOToDate(slotRow.endDateTime),
		slotRow.freeSeats
	));

	// filter to dateTime range
    if (from)
		slots = slots.filter((slot) => slot.startDateTime.getTime() >= from.getTime());
	
	if (to)
		slots = slots.filter((slot) => slot.startDateTime.getTime() <= to.getTime());

	return slots;
}

// TODO: createTimeSlot
// TODO: copy table set configuration from 1 slot to another

// TODO (later): deleteTimeSlot, updateTimeSlot

export { TimeSlot, getTimeSlotByStart, getAllTimeSlots };