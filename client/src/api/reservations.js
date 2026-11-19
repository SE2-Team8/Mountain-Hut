import httpClient from "@/lib/http-client";

const reservationsApi = {
    create: (data) => httpClient.post('/reservations', data),
    getAll: () => httpClient.get('/reservations', {}, { silent: true }),
    get: (reservId) => httpClient.get(`/reservations/${reservId}`),
    update: (reservId, data) => httpClient.put(`/reservations/${reservId}`, data),
};

export default reservationsApi;
