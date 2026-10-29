import httpClient from "@/lib/http-client";

const reservationsApi = {
    post: (payload) => httpClient.get(`/reservations`, payload)
};

export default reservationsApi;