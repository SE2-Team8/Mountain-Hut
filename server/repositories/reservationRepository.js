import { queryAll, queryGet, queryRun, withTransaction } from "../utils/query.js";

function Reservation(reservId, timeSlotId, userId, partySize) {
	this.reservId = reservId;
	this.timeSlotId = timeSlotId;
	this.userId = userId;
	this.partySize = partySize;
}

// returns the reservation with the given id, or null if not found
async function getReservationById(reservId) {
	const row = await queryGet(
		`SELECT * FROM reservations
		WHERE reservId = ?`, [reservId]
	);

	if (!row)
		return null;

	return new Reservation(row.reservId, row.timeSlotId, row.userId, row.partySize);
}

// returns an array of reservations for a specific userId. This method can also filter by timeSlotId, if specified
async function getReservationsByUser(userId, timeSlotId = null) {
	let reservRows = await queryAll(
		`SELECT * FROM reservations
		WHERE userId = ?`, [userId]
	);

	if (!reservRows)
		return null;

	if (timeSlotId != null)
		reservRows = reservRows.filter((row) => row.timeSlotId == timeSlotId);

	return reservRows.map((row) => new Reservation(
		row.reservId,
		row.timeSlotId,
		row.userId,
		row.partySize
	));
}

// given a timeSlot id and a party size, this function selects the tables that are assigned to the party with the following rules:
// - if there is not enough room for all the people, return an empty array
// - if there is enough space, the selection will try to assign the party to the least amount of tables and return the corresponding selection array
// the return value is an array where each element is an object { tableId, seatsToTake }
// the function may throws some error if the db interaction fails or the selection fails to allocate
// all the people when enough seats are available (should not happen) 
async function getAvailableTables(timeSlotId, partySize) {
	// select all tables that have some free seats, SORTED by increasing number of free seats 
	// (having tables sorted is needed for the table selection algorithm below)
	let freeTables = await queryAll(
		`SELECT tableNumber, tableId, totalSeats, freeSeats
		FROM tables
		WHERE timeSlotId = ? AND freeSeats > 0
		ORDER BY freeSeats ASC;`, [timeSlotId]
	);

	// check that there is enough space
	const totalFreeSeats = freeTables.reduce((sum, row) => sum + row.freeSeats, 0);
		
	// if not, return an empty array
	if (totalFreeSeats < partySize)
		return [];

	let selectedTables = []; // array of objects where tableId and seats to take are saved
	let peopleLeft = partySize; // people left to assign
	let lastTableIndex = freeTables.length - 1; // used to keep track of tables already considered

	let max_tries = 10000; // guard to avoid infinite loops
	while (peopleLeft > 0 && max_tries-- > 0 && lastTableIndex >= 0) {
		// console.log("party members left: ", peoplesLeft);
		let selectedTable = null;
		let seatsToTake = 0;

		// select tables: try to find the smallest table that contains all the peoples left
		for (let i = 0; i <= lastTableIndex; i++) {
			const table = freeTables[i];
			if (table.freeSeats >= peopleLeft) {
				selectedTable = table;
				seatsToTake = peopleLeft;
				break;
			}
		}

		// no table can contain all people left -> get the table with the highest number of free seats 
		// and occupy all the available seats, then continue
		if (selectedTable == null) {
			selectedTable = freeTables[lastTableIndex];
			seatsToTake = Math.min(peopleLeft, selectedTable.freeSeats);
			lastTableIndex -= 1; // when selecting a table it is not selectable anymore
		}

		// add the selected table to the list
		selectedTables.push({tableId: selectedTable.tableId, seatsToTake: seatsToTake });

		// update the number of people left to allocate
		peopleLeft -= seatsToTake;
	}

	// if max tries were exceeded or the people could not be fully assigned for some reason, throw an error
	if (max_tries <= 0 || peopleLeft > 0)
		throw new Error("Could not select tables for reservation!");

	// return the selected tables list
	return selectedTables;
}

// creates a reservation and returns the created reservation id.
// the only enforced business rules inside this method are the party size < available seats
// (other rules such as reservation time or author of the reservation must be checked somewhere else)
async function createReservation(userId, timeSlotId, partySize) {
	return await withTransaction(async () => {
		// get the available tables for the given slot and party size
		const reservTables = await getAvailableTables(timeSlotId, partySize);

		if (reservTables.length == 0)
			throw new Error("Not enough free seats to make a reservation");

		// console.log(reservTables);

		// occupy selected seats
		for (const { tableId, seatsToTake } of reservTables) {
			await queryRun(
				`UPDATE tables
				SET freeSeats = freeSeats - ?
				WHERE tableId = ?;`, 
				[seatsToTake, tableId]
			);
		};

		// create actual reservation
		const queryRes = await queryRun(
			`INSERT INTO reservations
			(userId, timeSlotId, partySize) VALUES (?, ?, ?)`, 
			[userId, timeSlotId, partySize]
		);
		const reservId = queryRes.lastID;
		
		// create table assignments
		for (const { tableId, seatsToTake } of reservTables) {
			await queryRun(
				`INSERT INTO tableAssignments
				(tableId, reservId, occupiedSeats) VALUES (?, ?, ?)`, 
				[tableId, reservId, seatsToTake]
			);
		};

		// return reservation id
		return reservId;
	});

}

// TODO (later): deleteReservation, updateReservation

export { Reservation, getReservationById, getReservationsByUser, createReservation, getAvailableTables };