import httpClient from "@/lib/http-client";

const timeslotsApi = {
    getAll: (params) => httpClient.get(`/timeslots`, params),
    reserve: (data) => httpClient.post(`/timeslots/reservation`, data)
};

export default timeslotsApi;