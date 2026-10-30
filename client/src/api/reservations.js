import httpClient from "@/lib/http-client";

const reservationsApi = {
    getAvailability: (date) => httpClient.get("/reservations/availability", { date }),
    create: (payload) => httpClient.post(`/reservations`, payload)
};

export default reservationsApi;