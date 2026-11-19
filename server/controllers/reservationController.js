import {createReservation, getReservationById,getReservationsByUser, updateReservation} from "../repositories/reservationRepository.js";
import { getTimeSlotById } from "../repositories/timeSlotRepository.js";
import { sendTemplateEmail } from "../services/smtpService.js";
import { formatDateTime } from "../utils/dateTimeFormatter.js";
import { responseError, responseSuccess } from "../utils/response.js";

const reservationController = {

	create: async (req, res) => {
		const { timeSlotId, partySize, dietaryRequirements } = req.body;
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

		const reservId = await createReservation(userId, timeSlotId, partySize, dietaryRequirements);

		const hasAnyAllergy = dietaryRequirements.some(req => req.allergies === true);
		const formattedRequirements = dietaryRequirements.length > 0
			? dietaryRequirements.map(req => 
				`${req.description} ${req.allergies ? '(Allergy)' : '(Diet)'}`
			).join(", ")
			: "None";

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
					allergies: hasAnyAllergy == true? "Yes" : "No",
					dietaryRequirements: formattedRequirements
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
	},
	retrieve: async (req, res) => {
		const reservId = Number(req.params.id);
		const reservation = await getReservationById(reservId);
		if (!reservation)
			return responseError(res, null, `Reservation not found`, 404);
		if (reservation.userId !== req.user.userId)
			return responseError(res, null, "You cannot retrieve another user's reservation", 403);

		const data = {
			reservId: reservId,
			timeSlotId: reservation.timeSlotId,
			startDateTime: reservation.startDateTime,
			endDateTime: reservation.endDateTime,
			partySize: reservation.partySize,
			dietaryRequirements: reservation.dietaryRequirements,
			tableAssignments: reservation.tableAssignments,
		};

		return responseSuccess(res, data, "Reservation retrieved");
	},

	retrieveAll: async (req, res) => {
		const reservations = await getReservationsByUser(req.user.userId);
		if (!reservations || reservations.length === 0)
			return responseSuccess(res, [], "No reservations found for this user");
		return responseSuccess(res, reservations, "Reservations retrieved");
	},

	update: async (req, res) => {
		const reservId = Number(req.params.id);
		const { timeSlotId, partySize, dietaryRequirements } = req.body;
		const userId = req.user.userId;

		const reservation = await getReservationById(reservId);
		if (!reservation) return responseError(res, null, `Reservation ${reservId} not found`, 404);
		if (reservation.userId !== userId)
			return responseError(res, null, "You cannot update another user's reservation", 403);

		const timeSlot = await getTimeSlotById(timeSlotId);
		if (!timeSlot) return responseError(res, null, `Time slot with timeSlotId=${timeSlotId} not found`, 404);

		const newStartMs = timeSlot.startDateTime.getTime();
		if (newStartMs - Date.now() < 2 * 60 * 60 * 1000)
			return responseError(res, null, "Reservation has to be updated at least 2 hours before the new slot.", 400);

		const bookedStartMs = reservation.startDateTime.getTime();
		const nowMs = Date.now();
		const msUntilBookedSlot = bookedStartMs - nowMs;
		if (msUntilBookedSlot < 48 * 60 * 60 * 1000)
			return responseError(res, null, "Reservation has to be updated at least 48 hours before the slot.", 400);

		const reservationsForSlot = await getReservationsByUser(userId, timeSlotId);
		if (reservationsForSlot?.some(item => item.reservId !== reservId))
			return responseError(res, null, "Reservation for that time slot already exists", 409);

		const seatsAvailable = timeSlot.freeSeats
			+ (reservation.timeSlotId == timeSlotId ? reservation.partySize : 0);
		if (seatsAvailable < partySize)
			return responseError(res, null, "Not enough free seats", 400);

		try {
			await updateReservation(reservId, timeSlotId, partySize, dietaryRequirements);
		} catch (error) {
			if (error.message === "Not enough free seats to change the reservation")
				return responseError(res, null, "Not enough free seats", 400);
			throw error;
		}
		const hasAnyAllergy = dietaryRequirements.some(req => req.allergies === true);
		const formattedRequirements = dietaryRequirements.length > 0
    		? dietaryRequirements.map(req =>
        	`${req.description} ${req.allergies ? "(Allergy)" : "(Diet)"}`
    		).join(", "): "None";
		await sendTemplateEmail({
			to: req.user.email,
			subject: "Reservation Updated",
			templateName: "reservation-update",
			data: {
				user: {
					fullName: req.user.fullName,
				},
				reservation: {
					reservId,
					userId,
					timeSlotId,
					partySize,
					allergies: hasAnyAllergy == true? "Yes" : "No",
					dietaryRequirements: formattedRequirements
				},
				timeSlot: {
					timeSlotId: timeSlot.timeSlotId,
					startDateTime: formatDateTime(timeSlot.startDateTime),
					endDateTime: formatDateTime(timeSlot.endDateTime),
				},
			},
			text: "Your reservation has been updated.",
		});
		return responseSuccess(res, null, "Reservation successfully updated");
	}
};

export default reservationController;
