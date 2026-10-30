import httpClient from "@/lib/http-client";

const authApi = {
    login: (payload) => {
        httpClient.post('/auth/login', payload)
    },
    signUp: (payload) => {
        httpClient.post('/auth/signUp', payload)
    },
};

export default authApi;