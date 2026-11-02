import db from "../../config/db.js";
import crypto from "crypto";
import { PWD_HASH_LEN, SALT_LEN } from "../../repositories/userRepository.js";
import { dateToStringISO } from "../../utils/dateTimeFormatter.js";
import app from "../../index.js";
import  request from "supertest";
import { queryGet } from "../../utils/query.js";

export const seed_db =  async () => {

// user seeding
const users = [
    {
		password: 'strong_password',
		role: 'WARDEN',
		fullName: 'Mario Rossi',
		email: 'mario.rossi@gmail.com',
		phoneNumber: '+39 1234567890',
		notes: null,
		emergencyContact: null
	},
	{
		password: 'weak_password',
		role: 'EMPLOYEE',
		fullName: 'Luigi Rossi',
		email: 'luigi.rossi@libero.it',
		phoneNumber: '+39 2345678901',
		notes: null,
		emergencyContact: null
	},
	{
		password: 'iLoveHuts',
		role: 'HIKER',
		fullName: 'Paola Bianchi',
		email: 'funnyhiker.82@gmail.com',
		phoneNumber: '+39 9876543210',
		notes: 'registered mountain guide',
		emergencyContact: '+39 8765432109'
	},
	{
		password: 'libellula',
		role: 'HIKER',
		fullName: 'Giovanni Muciaccia',
		email: 'gio.ilMucia@gmail.com',
		phoneNumber: '+39 1212121212',
		notes: null,
		emergencyContact: '+39 9876543210'
	},
];

// TODO: use repo constants for salt and hash lengths
users.forEach((user) => {
    user.salt = crypto.randomBytes(SALT_LEN).toString('hex');
    user.hashedPassword = crypto.scryptSync(user.password, user.salt, PWD_HASH_LEN).toString('hex');
});

db.serialize(() => {
    users.forEach((user) => {
        db.run(
            `INSERT INTO users 
			(passwordHash, passwordSalt, role, fullName, email, phoneNumber, notes, emergencyContact)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
				user.hashedPassword,
				user.salt,
				user.role,
				user.fullName,
				user.email,
				user.phoneNumber,
				user.notes,
				user.emergencyContact,
			]
        );
    });
});

// time slots seeding
const slots = [
	{
		// March 10, 2027, UTC 12:30:00 -> 14:30:00
		startDateTime: new Date(Date.UTC(2027, 2, 10, 12, 30, 0)), 
		endDateTime: new Date(Date.UTC(2027, 2, 10, 14, 30, 0))
	},
	{
		// March 10, 2027, UTC 18:30:00 -> 19:30:00
		startDateTime: new Date(Date.UTC(2027, 2, 10, 18, 30, 0)), 
		endDateTime: new Date(Date.UTC(2027, 2, 10, 19, 30, 0))
	},
	{
		// March 10, 2027, UTC 19:30:00 -> 21:00:00
		startDateTime: new Date(Date.UTC(2027, 2, 10, 19, 30, 0)), 
		endDateTime: new Date(Date.UTC(2027, 2, 10, 21, 0, 0))
	},
	{
		// March 11, 2027, UTC 12:00:00 -> 14:00:00
		startDateTime: new Date(Date.UTC(2027, 2, 11, 12, 0, 0)), 
		endDateTime: new Date(Date.UTC(2027, 2, 11, 14, 0, 0))
	},
];

db.serialize(() => {
    slots.forEach((slot) => {
        db.run(
            `INSERT INTO timeSlots (startDateTime, endDateTime) VALUES (?, ?)`,
            [
				dateToStringISO(slot.startDateTime),
				dateToStringISO(slot.endDateTime),
			]
        );
    });
});

// tables seeding
const tableLists = [
	// list 1
	[
		{
			number: 1,
			totalSeats: 6
		},
		{
			number: 2,
			totalSeats: 4
		},
		{
			number: 3,
			totalSeats: 6
		},
		{
			number: 4,
			totalSeats: 6
		},
		{
			number: 5,
			totalSeats: 4
		},
		{
			number: 6,
			totalSeats: 8
		},
	],
	// list 2
	[
		{
			number: 1,
			totalSeats: 4
		},
		{
			number: 2,
			totalSeats: 4
		},
		{
			number: 3,
			totalSeats: 4
		},
		{
			number: 4,
			totalSeats: 6
		},
		{
			number: 5,
			totalSeats: 6
		},
		{
			number: 6,
			totalSeats: 6
		},
	]
]

const slotsTableSets = [
	{
		slotId: 1,
		listIndex: 0
	},
	{
		slotId: 2,
		listIndex: 1
	},
	{
		slotId: 3,
		listIndex: 1
	},
]

db.serialize(() => {
	// for each slot-tableList assignment, load the list on the db
    slotsTableSets.forEach(({slotId, listIndex}) => {
		// for each table in the list, load it on the db
		tableLists[listIndex].forEach((table) => {
			db.run(
            `INSERT INTO tables (tableNumber, totalSeats, freeSeats, timeSLotId)
			 VALUES (?, ?, ?, ?)`,
            [
				table.number,
				table.totalSeats,
				table.totalSeats,
				slotId
			]
        );
		})
    });
});

// TODO: reservations seeding (?)
}


export const initSchema = async () => {
return new Promise((resolve, reject) => {
db.serialize(() => {
  db.run(`DROP TABLE IF EXISTS tableAssignments`);
  db.run(`DROP TABLE IF EXISTS tables`);
  db.run(`DROP TABLE IF EXISTS reservations`);
  db.run(`DROP TABLE IF EXISTS timeSlots`);
  db.run(`DROP TABLE IF EXISTS users`);

  // TODO: maybe manage roles differently?
  db.run(`CREATE TABLE IF NOT EXISTS users (
    userId INTEGER PRIMARY KEY AUTOINCREMENT,
    passwordHash TEXT NOT NULL,
    passwordSalt TEXT NOT NULL,
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
    startDateTime TEXT UNIQUE NOT NULL,
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
	totalSeats INTEGER NOT NULL DEFAULT 0,
	freeSeats INTEGER NOT NULL DEFAULT 0,
	timeSlotId INTEGER NOT NULL,
	FOREIGN KEY (timeSlotId) REFERENCES timeSlots(timeSlotId),
	UNIQUE (timeSlotId, tableNumber)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tableAssignments (
    tableId INTEGER NOT NULL,
    reservId INTEGER NOT NULL,
	occupiedSeats INTEGER NOT NULL,
	PRIMARY KEY (tableId, reservId),
	FOREIGN KEY (tableId) REFERENCES tables(tableId),
	FOREIGN KEY (reservId) REFERENCES reservations(reservId)
  )`, (err) => {
    if (err)
        reject(err)
    else resolve()
  });
});
})

}

export const clear_db = async () => {
    return new Promise( (resolve, reject) => {
        db.serialize( () => {
            db.run(`DELETE FROM tableAssignments`);
            db.run(`DELETE FROM tables`);
            db.run(`DELETE FROM timeSlots`);
            db.run(`DELETE FROM reservations`);
            db.run(`DELETE FROM users`, (err) => {
        if (err)
            reject (err)
        else
            resolve()
    });
        });
    });

}

export async function loginAs(email, password) {
  const agent = request.agent(app);
  const res = await agent.post("/api/sessions").send({ username: email, password });
  if (res.status !== 200) 
    throw new Error(`Login failed for ${email}: ${res.status}`);
  return agent;
}

export async function getUserId(email) {
  const row = await queryGet("SELECT userId FROM users WHERE email = ?", [email]);
  return row?.userId;
}



