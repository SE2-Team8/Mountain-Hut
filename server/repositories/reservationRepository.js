import { stringISOToDate } from "../utils/dateTimeFormatter.js";
import { queryAll, queryGet, queryRun, withTransaction } from "../utils/query.js";

function Reservation(reservId, timeSlotId, userId, partySize, dietaryRequirements, startDateTime = null, endDateTime = null, tableAssignments = null) {
	this.reservId = reservId;
	this.timeSlotId = timeSlotId;
	this.userId = userId;
	this.partySize = partySize;
	this.dietaryRequirements = dietaryRequirements;
	if (startDateTime) this.startDateTime = startDateTime;
	if (endDateTime) this.endDateTime = endDateTime;
	if (tableAssignments) this.tableAssignments = tableAssignments;	// [{ tableId, tableNumber, occupiedSeats }]
}

// returns the reservation with the given id, or null if not found:
// { reservId, userId, timeSlotId, partySize, dietaryRequirements, startDateTime, endDateTime,
// 		tablesAssignments: [{ tableId, tableNumber, occupiedSeats }] (sorted by table number) }
async function getReservationById(reservId) {
	const row = await queryGet(
		`SELECT reservations.*, timeSlots.startDateTime, timeSlots.endDateTime 
		FROM reservations JOIN timeSlots ON reservations.timeSlotId = timeSlots.timeSlotId
		WHERE reservations.reservId = ?`, [reservId]
	);

	if (!row)
		return null;

	const assignments = await queryAll(
		`SELECT tableAssignments.tableId, tables.tableNumber, tableAssignments.occupiedSeats
		FROM tableAssignments JOIN tables ON tableAssignments.tableId = tables.tableId
		WHERE tableAssignments.reservId = ?
		ORDER BY tables.tableNumber ASC`, [reservId]
	);

	return new Reservation(
		row.reservId,
		row.timeSlotId,
		row.userId,
		row.partySize,
		JSON.parse(row.dietaryRequirements),
		stringISOToDate(row.startDateTime),
		stringISOToDate(row.endDateTime),
		assignments,
	);
}

// returns an array of reservations for a specific userId. This method can also filter by timeSlotId, if specified
async function getReservationsByUser(userId, timeSlotId = null) {
	let reservRows = await queryAll(
		`SELECT reservations.*, timeSlots.startDateTime, timeSlots.endDateTime
		FROM reservations JOIN timeSlots ON reservations.timeSlotId = timeSlots.timeSlotId
		WHERE reservations.userId = ?
		ORDER BY timeSlots.startDateTime ASC`, [userId]
	);

	if (!reservRows)
		return [];

	if (timeSlotId != null)
		reservRows = reservRows.filter((row) => row.timeSlotId == timeSlotId);

	return reservRows.map((row) => new Reservation(
		row.reservId,
		row.timeSlotId,
		row.userId,
		row.partySize,
		JSON.parse(row.dietaryRequirements),
		stringISOToDate(row.startDateTime),
		stringISOToDate(row.endDateTime)
	));
}

// given a timeSlot id and a party size, this function selects the tables that are assigned to the party with the following rules:
// - if there is not enough room for all the people, return an empty array
// - if there is enough space, the selection will try to assign the party to the least amount of tables and return the corresponding selection array
// the return value is an array where each element is an object { tableId, tableNumber, seatsToTake }
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
		selectedTables.push({tableId: selectedTable.tableId, tableNumber: selectedTable.tableNumber, seatsToTake: seatsToTake });

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
async function createReservation(userId, timeSlotId, partySize, dietaryRequirements) {
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
			(userId, timeSlotId, partySize, dietaryRequirements) VALUES (?, ?, ?, ?)`, 
			[userId, timeSlotId, partySize, JSON.stringify(dietaryRequirements)]
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

// updates the timeslot, party size and dietary requirements of an existing reservation and returns the reservation id.
// the new values must always be passed (the caller keeps the old value for what does not change)
// - if the timeSlot and the party size are unchanged, only the dietary requirements are updated and the tables stays as they are
// - otherwise the change is treated as a new booking: the seats of the reservation are released and the tables are selected again with getAvailableTables (in the new timeSlot, if it changed)
// - if there are not enough seats the function throws and the reservation stays exactly as it was
// the other business rules must be checked in the controller
async function updateReservation(reservId, timeSlotId, partySize, dietaryRequirements) {
	return await withTransaction(async () => {
		const current = await queryGet(
			`SELECT * FROM reservations
			WHERE reservId = ?`, [reservId]
		);

		if (!current)
			throw new Error("Reservation not found");

		const seatsChanged = current.timeSlotId != timeSlotId || current.partySize != partySize;

		if (seatsChanged) {
			// release the seats currently taken by the reservation
			const oldAssignments = await queryAll(
				`SELECT tableId, occupiedSeats 
				FROM tableAssignments
				WHERE reservId = ?`, [reservId]
			);

			for (const { tableId, occupiedSeats } of oldAssignments) {
				await queryRun(
					`UPDATE tables
					SET freeSeats = freeSeats + ?
					WHERE tableId = ?`, [occupiedSeats, tableId]
				);
			}

			await queryRun(
				`DELETE FROM tableAssignments
				WHERE reservId = ?`, [reservId]
			);

			// select the tables again, as for a new booking (the previously released seats are available again)
			const reservTables = await getAvailableTables(timeSlotId, partySize);

			if (reservTables.length == 0)
				throw new Error("Not enough free seats to change the reservation");

			for (const { tableId, seatsToTake } of reservTables) {
				await queryRun(
					`UPDATE tables
					SET freeSeats = freeSeats - ?
					WHERE tableId = ?`, [seatsToTake, tableId]
				);

				await queryRun(
					`INSERT INTO tableAssignments (tableId, reservId, occupiedSeats)
					VALUES (?, ?, ?)`, [tableId, reservId, seatsToTake]
				);
			}
		}

		await queryRun(
			`UPDATE reservations
			SET timeSlotId = ?, partySize = ?, dietaryRequirements = ?
			WHERE reservId = ?`,
			[timeSlotId, partySize, JSON.stringify(dietaryRequirements), reservId]
		);

		return reservId;
	});
}

// TODO (later): deleteReservation

export { Reservation, getReservationById, getReservationsByUser, createReservation, getAvailableTables, updateReservation };