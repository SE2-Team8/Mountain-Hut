import express from "express";
import corsConfig from './config/corsConfig.js';
import router from './router/index.js';
import exceptionHandler from './middlewares/ecxeptionHandler.js';
import session from "express-session";
import passportConfig from "./config/passportConfig.js";
import { createHiker } from "./repositories/userRepository.js";
import { getTimeSlotByStart, getAllTimeSlots } from "./repositories/timeslotRepository.js";
import { createReservation } from "./repositories/reservationRepository.js";

const app = express();
const port = 3001;

app.use(session({
  secret: "My very hard to guess secret",
  resave: false,
  saveUninitialized: false,
}));
app.use(passportConfig);
app.use(corsConfig);
app.use(express.json());
app.use('/api', router);
app.use(exceptionHandler);

// -- apis to create, get and delete the current session --

app.post("/api/sessions", passport.authenticate("local"), function(req, res) {
	return res.status(201).json(req.user);
});

app.get("/api/sessions/current", (req, res) => {
	if (req.isAuthenticated()){
		res.json(req.user);
	} else{
		res.status(401).json({ error: "Not authenticated" });
	}
});

app.delete("/api/sessions/current", (req, res) => {
	req.logOut(() => { res.end(); });
});

// ----

// -- api to register a new hiker --

app.post("/api/register", async (req, res) => {
	const { psw, fullName, email, phone, notes, emergencyContact } = req.body;

	try{
		const newUser = await createHiker(psw, fullName, email, phone, notes, emergencyContact);
		req.login(newUser, (err) => {
			if (err) return res.status(500).json({ error: "Error during authomatic login" });
			return res.status(201).json(newUser);
		});
	}
	catch (ex) {
		console.error(ex);
		if (ex.message && ex.message.includes("UNIQUE constraint failed"))
            return res.status(400).json({ error: "Email already in use." });
        return res.status(500).json({ error: "Internal server error." });
	}
});

// ----

// -- apis for the time slots --

// retrieve all time slots
// 4 possible call:
// 1: /api/timeslots -> retrieve all time slots in the database
// 2: /api/timeslots?from=yyyy-mm-ddThh:mm:ssZ -> retrieve all time slots starting from "from"
// 3: /api/timeslots?to=yyyy-mm-ddThh:mm:ssZ -> retrieve all time slots up to "to"
// 4: /api/timeslots?from=yyyy-mm-ddThh:mm:ssZ&to=yyyy-mm-ddThh:mm:ssZ -> retrieve all time slots from"from" up to "to"

app.get("/api/timeslots", async (req, res) => {
	try {
		const from = req.query.from || null;
		const to = req.query.to || null;
		const slots = await getAllTimeSlots(from, to);

		res.status(200).json(slots);
	}
	catch (ex){
		console.error("Error retrieving time slots: ", ex);
		res.status(500).json({ error: "Internal server error during the retrival of time slots"} );
	}
});

// get a time slot given its start

app.get("/api/timeslots/:start", (req, res) => {
	const start = req.params.start;
	getTimeSlotByStart(start).then(slot => req.json(res)).catch(() => res.status(500).end());
})

// ----

// -- apis for the reservation --

app.post("/api/timeslots/reservation", async (req, res) => {
	try{
		const { timeSlotId, userId, partySize } = req.body;
		if (!timeSlotId || !userId || !partySize){
			return res.status(400).json({ error: "Missing data."});
		}
		if (partySize <= 0) return res.status(400).json({ error: "Party size must be greater than 0."});

		const reservation = await createReservation(timeSlotId, userId, partySize);

		res.status(201).json({ message: "Reservation succesfully taken"});
	}
	catch(ex){
		console.error("Error during reservation creation: ", ex);
		res.status(500).json({ error: "Internal server error"});
	}
});

// ----

// -- apis for the tables --
// TODO: wait for the tables' repository implementation
// ----

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});