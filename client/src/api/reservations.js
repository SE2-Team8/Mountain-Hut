import httpClient from "@/lib/http-client";

const delay = ms => new Promise(res => setTimeout(res, ms));

const reservationsApi = {
    create: (data) => httpClient.post('/reservations', data),
	get: async (reservId) => { // TEMP RESPONSE
		console.log("called API get reservation");
		await delay(2000);
		return {
			reservId: reservId,
			timeSlotId: 1,
			timeSlotDate: new Date(),
			startTime: "17:10",
			endTime: "19:50",
			userId: 1,
			partySize: 3,
			// OTHER FIELDS
			tableAssignments: [
				{tableNumber: 5, takenSeats: 10},
				{tableNumber: 6, takenSeats: 2},
			]
		}
	},
	// get: (reservId) => httpClient.get(`/reservations/${reservId}`), // TODO: ensure this endpoint is consistent with server
};

export default reservationsApi;
