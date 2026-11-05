import authApi from "./auth";
import timeslotsApi from "./timeslots";
import usersApi from "./users";

const api = {
    auth: authApi,
    users: usersApi,
    timeslots: timeslotsApi
}

export default api;