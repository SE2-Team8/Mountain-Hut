import httpClient from "@/lib/http-client";

const reservationsApi = {
    create: (data) => httpClient.post('/reservations', data),
};

export default reservationsApi;
