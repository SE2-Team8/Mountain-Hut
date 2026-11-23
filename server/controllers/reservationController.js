import {createReservation, getReservationById,getReservationsByUser, updateReservation} from "../repositories/reservationRepository.js";
import { getTimeSlotById } from "../repositories/timeSlotRepository.js";
import { getUserById, isStaff } from "../repositories/userRepository.js";
import { sendTemplateEmail } from "../services/smtpService.js";
import { formatDateTime } from "../utils/dateTimeFormatter.js";
import { responseError, responseSuccess } from "../utils/response.js";

const reservationController = {

	create: async (req, res) => {
		const { timeSlotId, partySize, dietaryRequirements, tmpHikerName, tmpHikerPhone } = req.body;

		// if temp hiker phone is specified, so must the temp hiker name
		if (tmpHikerPhone && !tmpHikerName) return responseError(res, null, `Temp hiker name must be present if temp hiker phone is specified`, 400);

		// get user who made the request
		const reqUserId = req.user.userId;
		const reqUser = await getUserById(reqUserId);
		const reqFromStaff = isStaff(reqUser);

		// get user which is the recipient of the reservation
		const reservationUserId = req.body.userId;
		const reservationUser = await getUserById(reservationUserId);
		const reqForExistingHiker = !isStaff(reservationUser);
		const reqForTempHiker = tmpHikerName? true : false;

		// if the request is made by a hiker, it must be for themselves
		if (!reqFromStaff && reqUserId != reservationUserId)
			return responseError(res, null, `A hiker can only make a reservation for themselves`, 400);

		// if the request is made for an hiker, the temporary hiker must be null
		if (reqForExistingHiker && reqForTempHiker)
			return responseError(res, null, `There cannot be both a hiker userId and a temporary hiker for a reservation`, 400);

		// if the request is not made for an hiker, the temporary hiker must be present
		if (!reqForExistingHiker && !reqForTempHiker)
			return responseError(res, null, `A reservation must be done for either an existing hiker or a temporary one`, 400);

		// if the request is made by an employee for a temporary hiker, the userId in the reservation must be the employee themselves
		if (reqFromStaff && reqForTempHiker && reqUserId != reservationUserId)
			return responseError(res, null, `An employee making a reservation for a temporary hiker must specify their own userId in the body`, 400);

		// get the reservation timeslot
		const timeSlot = await getTimeSlotById(timeSlotId);
		if (!timeSlot)
			return responseError(res, null, `Time slot with timeSltoId=${timeSlotId} not found`, 404);

		// if the request is not made by an employee, a reservation can be done only up to 2h before the time slot start time
		if (!reqFromStaff) {
			const startMs = timeSlot.startDateTime.getTime();
			const nowMs = Date.now();

			// since startMs and nowMs are in milliseconds -> 2h = 2 * 60(minutes) * 60(seconds) * 1000(milliseconds)
			if (startMs - nowMs < (2 * 60 * 60 * 1000))
				return responseError(res, null, "Reservation has to be taken at least 2 hours before the slot.", 400);
		}

		// if the request is made for an existing hiker, only 1 reservation can be done
		if (reqForExistingHiker) {
			const alreadyTaken = await getReservationsByUser(reservationUserId, timeSlotId);
			if (alreadyTaken && alreadyTaken.length > 0)
				return responseError(res, null, "User already has a reservation for the selected time slot", 409);
		}

		// check that there is enough space
		if (timeSlot.freeSeats < partySize) return responseError(res, null, "Not enough free seats", 400);

		// actually make the reservation (for the right user)
		const reservId = await createReservation(reservationUserId, timeSlotId, partySize, dietaryRequirements, tmpHikerName, tmpHikerPhone);

		// send the email only if the reservation is made for an existing hiker
		if (reqForExistingHiker) {
			const hasAnyAllergy = dietaryRequirements.some(req => req.allergies === true);
			const formattedRequirements = dietaryRequirements.length > 0
				? dietaryRequirements.map(req => 
					`${req.description} ${req.allergies ? '(Allergy)' : '(Diet)'}`
				).join(", ")
				: "None";

			await sendTemplateEmail({
				to: reservationUser.email,
				subject: "Reservation Confirmation",
				templateName: "reservation-confirmation",
				data: {
					user: {
						fullName: reservationUser.fullName,
					},
					reservation: {
						reservId,
						userId: reqUserId,
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
		}
		

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
