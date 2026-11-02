import { queryRun, withTransaction, queryAll } from "../utils/query.js"

function Table(tableId, tableNumber, totalSeats, timeSlotId){
    this.tableId = tableId;
    this.tableNumber = tableNumber;
    this.totalSeats = totalSeats;
    this.freeSeats = totalSeats;
    this.timeSlotId = timeSlotId;
}

// this function create a set of tables for timeSlotId
// with the list of tables tableList
// the list will be composed of json object
// example: [{ tableNumber: 1, totalSeats: 10 }, { tableNumber: 2, totalSeats: 5 }]
async function createTableSetManually(timeSlotId, tablesList) {
    await withTransaction(async () => {
        for (const {tableNumber, totalSeats} of tablesList){
            await queryRun(
                `INSERT INTO tables
                (tableNumber, totalSeats, freeSeats, timeSlotId) VALUES (?, ?, ?, ?)`,
                [tableNumber, totalSeats, totalSeats, timeSlotId]
            );
        }
    });
}

// this function create a set of tables for timeSlotIdTo
// copying the set of tables of timeSlotIdFrom
async function createTableSetFromTimeSlot(timeSlotIdTo, timeSlotIdFrom){
    await withTransaction(async () => {
        const tablesList = await queryAll(
            `SELECT tableId, tableNumber, totalSeats
            FROM tables
            WHERE timeSlotId = ?`,
            [timeSlotIdFrom]
        );

        for (const {tableNumber, totalSeats} of tablesList){
            await queryRun(
                `INSERT INTO tables
                (tableNumber, totalSeats, freeSeats, timeSlotId) VALUES (?, ?, ?, ?)`,
                [tableNumber, totalSeats, totalSeats, timeSlotIdTo]
            );
        }
    });
}

export {Table, createTableSetManually, createTableSetFromTimeSlot}