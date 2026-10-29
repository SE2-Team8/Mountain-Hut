import { responseError } from "../utils/response.js";

const requireRole = (...allowedRoles) => {
	return (req, res, next) => {
		if (!req.isAuthenticated()) {
			return responseError(res, null, 'Not Authenticated!', 401);
		}
		const hasRole = allowedRoles.inc(req.user.role);
		if (!hasRole) {
			return responseError(res, null, 'Forbidden', 403);
		}

		return next();
	};
};