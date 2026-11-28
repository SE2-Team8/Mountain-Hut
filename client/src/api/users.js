import httpClient from "@/lib/http-client";

const usersApi = {
    get: (userId) => httpClient.get(`/users/${userId}`),
    search: (value) => httpClient.get(`/users/search`, { value }, { silent: true }),
    create: (body) => httpClient.post(`/users`, body),
};

export default usersApi;
