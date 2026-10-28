import db from "../config/db.js"

db.serialize(() => {
  db.run(`DROP TABLE IF EXISTS users`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    salt TEXT NOT NULL
  )`);

  // TODO: change users table fields (??? waiting for reply to issue)
  // TODO: add reservations table (reservId, userId, partySize, timeslotId, .. notes, allergies)
  // TODO: add timeSlots table (timeslotId, startDateTime, endDateTime, ... menu)
  // TODO (for later): add tables table (tableId, tableNumber, timeslotId, numberOfSeats)
  // TODO (for later): add tableAssignments table (reservId, tableId, occupiedSeats)
});

db.close();