import { createReservation } from "../repositories/reservationRepository.js";
import { responseError, responseSuccess } from "../utils/response.js";

const reservationController = {
    create: async (req, res) => {
        const { timeSlotId, userId, partySize } = req.body;
		if (!timeSlotId || !userId || !partySize){
			return responseError(res, null, "Missing data.", 400);
		}
		if (partySize <= 0) return responseError(res, null, "Party size must be greater than 0.", 400);

		const reservation = await createReservation(timeSlotId, userId, partySize);

		return responseSuccess(res, reservation, "Reservation successfully taken", 201);
    }
};

export default reservationController;