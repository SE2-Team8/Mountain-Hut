import httpClient from "@/lib/http-client";

const usersApi = {
    get: (userId) => httpClient.get(`/users/${userId}`)
};

export default usersApi;
