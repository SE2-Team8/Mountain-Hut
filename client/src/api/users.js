import httpClient from "@/lib/http-client";

const usersApi = {
    get: (userId) => httpClient.get(`/users/${userId}`),
    search: (value) => httpClient.get("/users/search", { value }, { silent: true }),
};

export default usersApi;
