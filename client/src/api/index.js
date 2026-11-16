import authApi from "./auth";
import reservationsApi from "./reservations";
import timeslotsApi from "./timeslots";
import usersApi from "./users";

const api = {
    auth: authApi,
    reservations: reservationsApi,
    users: usersApi,
    timeslots: timeslotsApi
}

export default api;
