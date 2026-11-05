import httpClient from "@/lib/http-client";

const timeslotsApi = {
    getAll: (params) => httpClient.get(`/timeslots`, params),
    create: (data) => httpClient.post(`/timeslots`, data),
    reserve: (data) => httpClient.post(`/timeslots/reservation`, data)
};

export default timeslotsApi;
