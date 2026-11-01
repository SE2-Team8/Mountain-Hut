import { createReservation, getReservationsByUser } from "../repositories/reservationRepository.js";
import { getTimeSlotById } from "../repositories/timeSlotRepository.js";
import { responseError, responseSuccess } from "../utils/response.js";

const reservationController = {
    create: async (req, res) => {
        const { timeSlotId, partySize } = req.body;
		const userId = req.user.userId;
		if (!timeSlotId || !partySize){
			return responseError(res, null, "Missing data.", 400);
		}
		if (partySize <= 0) return responseError(res, null, "Party size must be greater than 0.", 400);

		const timeSlot = await getTimeSlotById(timeSlotId);
		const startMs = timeSlot.startDateTime.getTime();
		const nowMs = Date.now();

		// since startMs and nowMs are in milliseconds -> 2h = 2 * 60(minutes) * 60(seconds) * 1000(milliseconds)
		if (startMs - nowMs < (2*60*60*1000)) return responseError(res, null, "Reservation has to be taken at least 2 hours before the slot.", 400);

		const alreadyTaken = await getReservationsByUser(userId, timeSlotId);
		if (alreadyTaken && alreadyTaken.length > 0) return responseError(res, null, "Reservation for that time slot already exist", 409);

		const reservation = await createReservation(userId, timeSlotId, partySize);

		return responseSuccess(res, reservation, "Reservation successfully taken", 201);
    }
};

export default reservationController;