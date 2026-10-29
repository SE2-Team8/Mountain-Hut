import authApi from "./auth";
import reservationsApi from "./reservations";
import usersApi from "./users";

const api = {
    auth: authApi,
    users: usersApi,
    reservations: reservationsApi
}

export default api;