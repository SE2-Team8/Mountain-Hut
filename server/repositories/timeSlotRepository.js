import { queryAll, queryGet } from "../utils/query.js";
import { stringISOToDate } from "../utils/dateTimeFormatter.js";

function TimeSlot(timeSlotId, startDateTime, endDateTime, freeSeats) {
	this.timeSlotId = timeSlotId
	this.startDateTime = startDateTime;
	this.endDateTime = endDateTime;
	this.freeSeats = freeSeats;
}

async function getTimeSlotByStart(startDateTime) {
	const dateTimeString = dateToStringISO(startDateTime);
    const slotRow = await queryGet(
		`SELECT timeSlots.*, SUM(totalSeats - occupiedSeats) as freeSeats
		FROM timeSlots WHERE startDateTime = ?`, [dateTimeString]);

    if (!slotRow) return null;

    return TimeSlot(
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
		FROM timeSlots, tables
		WHERE tables.timeSlotId = timeSlots.timeSlotId
		GROUP BY timeSlots.timeSlotId`);

    let slots = slotRows.map((slotRow) => TimeSlot(
		slotRow.timeSlotId,
		stringISOToDate(slotRow.startDateTime),
		stringISOToDate(slotRow.endDateTime),
		slotRow.freeSeats
	));

	// filter to dateTime range
    if (from)
		slots = slots.filter((slot) => slot.endDateTime.getTime() >= from);
	
	if (to)
		slots = slots.filter((slot) => slot.startDateTime.getTime() <= from);
}

// TODO: createTimeSlot
// TODO: copy table set configuration from 1 slot to another

// TODO (later): deleteTimeSlot, updateTimeSlot

export { TimeSlot, getTimeSlotByStart, getAllTimeSlots };