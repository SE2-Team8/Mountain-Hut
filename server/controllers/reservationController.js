import { createReservation, getReservationsByUser } from "../repositories/reservationRepository.js";
import { getTimeSlotById } from "../repositories/timeSlotRepository.js";
import { sendTemplateEmail } from "../services/smtpService.js";
import { formatDateTime } from "../utils/dateTimeFormatter.js";
import { responseError, responseSuccess } from "../utils/response.js";

const reservationController = {
	create: async (req, res) => {
		const { timeSlotId, partySize } = req.body;
		const userId = req.user.userId;

		const timeSlot = await getTimeSlotById(timeSlotId);
		if (!timeSlot) return responseError(res, null, `Time slot with timeSltoId=${timeSlotId} not found`, 404);

		const startMs = timeSlot.startDateTime.getTime();
		const nowMs = Date.now();

		// since startMs and nowMs are in milliseconds -> 2h = 2 * 60(minutes) * 60(seconds) * 1000(milliseconds)
		if (startMs - nowMs < (2 * 60 * 60 * 1000)) return responseError(res, null, "Reservation has to be taken at least 2 hours before the slot.", 400);

		const alreadyTaken = await getReservationsByUser(userId, timeSlotId);
		if (alreadyTaken && alreadyTaken.length > 0) return responseError(res, null, "Reservation for that time slot already exist", 409);

		if (timeSlot.freeSeats < partySize) return responseError(res, null, "Not enough free seats", 400);

		const reservId = await createReservation(userId, timeSlotId, partySize);

		await sendTemplateEmail({
			to: req.user.email,
			subject: "Reservation Confirmation",
			templateName: "reservation-confirmation",
			data: {
				user: {
					fullName: req.user.fullName,
				},
				reservation: {
					reservId,
					userId,
					timeSlotId,
					partySize,
				},
				timeSlot: {
					timeSlotId: timeSlot.timeSlotId,
					startDateTime: formatDateTime(timeSlot.startDateTime),
					endDateTime: formatDateTime(timeSlot.endDateTime),
				},
			},
			text: "Your reservation has been confirmed.",
		});

		return responseSuccess(res, reservId, "Reservation successfully taken", 201);
	}
};

export default reservationController;
