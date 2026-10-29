import express from "express";
import corsConfig from './config/corsConfig.js';
import passport from 'passport';
import LocalStrategy from 'passport-local';
import router from './router/index.js';
import ecxeptionHandler from './middlewares/ecxeptionHandler.js';
import { getUserFromCredentials } from "./repositories/userRepository.js";
import session from "express-session";

const app = express();
const port = 3001;

// passport configuration
passport.use(new LocalStrategy(async function verify(email, password, callback) {
	try {
		const user = await getUserFromCredentials(email, password);
		if(user == null)
			// error message in the WWW-Authenticate header of the response
			return callback(null, false, "Wrong email or password.");
		else
			return callback(null, user);
	} catch (error) {
		return callback(null, false, "Error happened while checking credentials");
	}
}));

passport.serializeUser(function (user, callback) {
  callback(null, user);
});

passport.deserializeUser(function (user, callback) {
  return callback(null, user);
});

app.use(session({
  secret: "My very hard to guess secret",
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.authenticate("session"));
app.use(corsConfig);
app.use(express.json());
app.use('/api', router);
app.use(ecxeptionHandler);

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});