import httpClient from "@/lib/http-client";

const authApi = {
    login: (payload) => httpClient.post('/auth/login', payload)
};

export default authApi;