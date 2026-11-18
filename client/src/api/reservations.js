import httpClient from "@/lib/http-client";
import { success } from "zod";

const delay = ms => new Promise(res => setTimeout(res, ms));

const reservationsApi = {
    create: (data) => httpClient.post('/reservations', data),
	get: async (reservId) => { // TEMP RESPONSE
		console.log("called API get reservation");
		await delay(1000); // temp delay
		return {
			success: true,
			data: {
				reservId: reservId,
				timeSlotId: 1,
				startDateTime: new Date("2027-03-10T17:01:01.000Z").toISOString(),
				endDateTime: new Date("2027-03-10T18:10:01.000Z").toISOString(),
				userId: 1,
				partySize: 3,
				// OTHER FIELDS
				dietaryRequirements: [
					{ allergies: false, description: "2 Vegetarian"},
					{ allergies: true, description: "1 No nuts"}
				],
				tableAssignments: [
					{tableNumber: 5, takenSeats: 10},
					{tableNumber: 6, takenSeats: 2},
				]
			}
		}
	},

	update: async (reservId, newReservation) => { // TEMP
		console.log("called API update reservation");
		await delay(1000); // temp delay
		return {
			success: true,
			data: {}
		}
	},
	// update: (reservId, body) => httpClient.put(`/reservations/${reservId}`, body), // TODO: ensure this endpoint is consistent with server
};

export default reservationsApi;
