import httpClient from "@/lib/http-client";

const delay = ms => new Promise(res => setTimeout(res, ms));

const reservationsApi = {
    create: (data) => httpClient.post('/reservations', data),
	get: async (reservId) => { // TEMP RESPONSE
		console.log("called API get reservation");
		await delay(2000); // temp delay
		return {
			reservId: reservId,
			timeSlotId: 1,
			startDateTime: new Date("2027-03-10T00:00:01.000Z"),
			endDateTime: new Date("2027-03-10T00:10:01.000Z"),
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
	},
	// get: (reservId) => httpClient.get(`/reservations/${reservId}`), // TODO: ensure this endpoint is consistent with server
};

export default reservationsApi;
