import db from "../config/db.js"

db.serialize(() => {
  db.run(`DROP TABLE IF EXISTS tableAssignments`);
  db.run(`DROP TABLE IF EXISTS tables`);
  db.run(`DROP TABLE IF EXISTS reservations`);
  db.run(`DROP TABLE IF EXISTS timeSlots`);
  db.run(`DROP TABLE IF EXISTS users`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    userId INTEGER PRIMARY KEY AUTOINCREMENT,
    hashedPassword TEXT NOT NULL,
    salt TEXT NOT NULL,
	role TEXT NOT NULL CHECK (role IN ('HIKER', 'EMPLOYEE', 'WARDEN')),
    fullName TEXT NOT NULL,
	email TEXT UNIQUE NOT NULL,
	phoneNumber TEXT NOT NULL,
	notes TEXT,
	emergencyContact TEXT
  )`);

  // dateTimess are saved as ISO strings (yyyy-mm-ddThh:mm:ssZ)  
  db.run(`CREATE TABLE IF NOT EXISTS timeSlots (
    timeSlotId INTEGER PRIMARY KEY AUTOINCREMENT,
    startDateTime TEXT NOT NULL,
	endDateTime TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reservations (
    reservId INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
	timeSlotId INTEGER NOT NULL,
	partySize INTEGER NOT NULL,
	FOREIGN KEY (userId) REFERENCES users(userId),
	FOREIGN KEY (timeSlotId) REFERENCES timeSlots(timeSlotId)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tables (
    tableId INTEGER PRIMARY KEY AUTOINCREMENT,
    tableNumber INTEGER NOT NULL,
	numberOfSeats INTEGER NOT NULL,
	timeSlotId INTEGER NOT NULL,
	FOREIGN KEY (timeSlotId) REFERENCES timeSlots(timeSlotId)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tableAssignments (
    tableId INTEGER NOT NULL,
    reservId INTEGER NOT NULL,
	occupiedSeats INTEGER NOT NULL,
	PRIMARY KEY (tableId, reservId),
	FOREIGN KEY (tableId) REFERENCES tables(tableId),
	FOREIGN KEY (reservId) REFERENCES reservations(reservId)
  )`);

  // TODO: change users table fields (??? waiting for reply to issue)
  // TODO: add reservations table (reservId, userId, partySize, timeslotId, .. notes, allergies)
  // TODO: add timeSlots table (timeslotId, startDateTime, endDateTime, ... menu)
  // TODO (for later): add tables table (tableId, tableNumber, timeslotId, numberOfSeats)
  // TODO (for later): add tableAssignments table (reservId, tableId, occupiedSeats)
});

db.close();