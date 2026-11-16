import httpClient from "@/lib/http-client";

const timeslotsApi = {
    getAll: (params) => httpClient.get(`/timeslots`, params),
    create: (data) => httpClient.post(`/timeslots`, data),
    checkAvailability: (params) => httpClient.get(`/timeslots/availability`, params),
};

export default timeslotsApi;
