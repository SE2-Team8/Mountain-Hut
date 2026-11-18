import httpClient from "@/lib/http-client";

// DEBUG
const delay = ms => new Promise(res => setTimeout(res, ms));
const start = new Date("2027-03-10T18:30:00.000Z").toISOString();
const end = new Date("2027-03-10T20:30:00.000Z").toISOString();
let reservation = {
	reservId: 6,
	timeSlotId: 2,
	startDateTime: start,
	endDateTime: end,
	partySize: 3,
	dietaryRequirements: [
		{ allergies: false, description: "2 Vegetarian"},
		{ allergies: true, description: "1 No nuts"}
	]
};

const reservationsApi = {
    create: (data) => httpClient.post('/reservations', data),
	// get: (reservId) => httpClient.get(`/reservations/${reservId}`), // TODO: ensure this endpoint is consistent with server
	get: async (reservId) => { // TEMP RESPONSE
		console.log("called API get reservation");
		await delay(1000); // temp delay
		return {
			success: true,
			data: reservation,
		}
	},

	// update: (reservId, body) => httpClient.put(`/reservations/${reservId}`, body), // TODO: ensure this endpoint is consistent with server
	update: async (reservId, newReservation) => { // TEMP
		console.log("called API update reservation");
		await delay(1000); // temp delay
		reservation = newReservation;
		reservation.startDateTime = start;
		reservation.endDateTime = end;
		return {
			success: true,
			data: {}
		}
	},
};

export default reservationsApi;
