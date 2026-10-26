import httpClient from "@/lib/http-client";

const usersApi = {
    get: (id) => httpClient.get(`/users/${id}`)
};

export default usersApi;