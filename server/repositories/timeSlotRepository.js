import { queryGet } from "../utils/query.js";

async function getTimeSlotByStart(startDateTime) {
    const slot = await queryGet('SELECT * FROM reservations WHERE startDateTime = ?', [startDateTime]);

    if (!slot) return false;

    return {
        startDateTime: slot.startDateTime,
        endDateTime: slot.endDateTime
		// TODO: other fields
    }
}

// TODO: getAllTimeSlots (maybe get timeslots with also the number of free seats?)

// TODO: createTimeSlot

// TODO (later): deleteTimeSlot, updateTimeSlot

export { getTimeSlotByStart };