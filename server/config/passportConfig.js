import passport from 'passport';
import LocalStrategy from 'passport-local';
import { getUserFromCredentials } from '../repositories/userRepository.js';

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

const passportConfig = passport.authenticate("session");

export default passportConfig;