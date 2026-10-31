import { queryAll, queryGet, queryRun, withTransaction } from "../utils/query.js";

// creates a reservation and returns the created reservation id.
// the only enforced business rules inside this method are the party size < available seats
// (other rules such as reservation time or author of the reservation must be checked somewhere else)
async function createReservation(timeSlotId, userId, partySize) {
	return await withTransaction(async () => {
		// select all tables that have some free seats, sorted by increasing number of free seats
		let freeTables = await queryAll(
			`SELECT tableNumber, tableId, totalSeats, freeSeats
			FROM tables
			WHERE timeSlotId = ? AND freeSeats > 0
			ORDER BY freeSeats ASC;`, [timeSlotId]
		);

		// check that there is enough space
		const totalFreeSeats = freeTables.reduce((sum, row) => sum + row.freeSeats, 0);
		
		// debug
		// console.log("Total number of free seats: ", totalFreeSeats, ". Available tables:\n", freeTables);
		
		if (totalFreeSeats < partySize)
			throw new Error("Not enough free seats to make a reservation");

		// array of objects where tableId and seats to take are saved
		let reservTables = [];
		let peoplesLeft = partySize;
		let lastTableIndex = freeTables.length - 1;
		let max_tries = 10000;
		while (peoplesLeft > 0 && max_tries-- > 0) {
			if (lastTableIndex < 0)
				throw new Error("Could not select tables for reservation!");

			// console.log("party members left: ", peoplesLeft);

			// select tables: try to find the smallest table that contains all the peoples left
			let singleTable = null;
			for (let i = 0; i <= lastTableIndex; i++) {
				const table = freeTables[i];
				if (table.freeSeats >= peoplesLeft) {
					singleTable = table;
					break;
				}
			}

			// such table exists -> select it and that's it
			let selectedTableId = 0;
			let seatsToTake = 0;
			if (singleTable != null) {
				selectedTableId = singleTable.tableId;
				seatsToTake = peoplesLeft;
			}
			// no such table exists -> get the table with the highest number of free seats 
			// and occupy all the available seats, then continue
			else {
				const table = freeTables[lastTableIndex];
				seatsToTake = Math.min(peoplesLeft, table.freeSeats);
				selectedTableId = table.tableId;
				lastTableIndex -= 1; // when selecting a table it is not selectable anymore
			}

			// update the number of people left to allocate
			peoplesLeft -= seatsToTake;
			// add the selected table to a list (to make assignments later)
			reservTables.push({id: selectedTableId, seatsToTake: seatsToTake });
		}

		if (max_tries <= 0)
			throw new Error("Could not select tables for reservation!");

		console.log(reservTables);

		// occupy selected seats
		// create table assignments
		reservTables.forEach(async ({id, seatsToTake}) => {
			await queryRun(
				`UPDATE tables
				SET freeSeats = freeSeats - ?
				WHERE tableId = ?;`, 
				[seatsToTake, id]
			);
		});

		// create reservation
		const queryRes = await queryRun(
			`INSERT INTO reservations
			(userId, timeSlotId, partySize) VALUES (?, ?, ?)`, 
			[userId, timeSlotId, partySize]
		);
		const reservId = queryRes.lastID;
		
		// create table assignments
		reservTables.forEach(async ({id, seatsToTake}) => {
			await queryRun(
				`INSERT INTO tableAssignments
				(tableId, reservId, occupiedSeats) VALUES (?, ?, ?)`, 
				[id, reservId, seatsToTake]
			);
		});

		// return reservation id
		return reservId;
	});

}

// TODO (later): deleteReservation, updateReservation

export { createReservation };