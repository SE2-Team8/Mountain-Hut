import httpClient from "@/lib/http-client";

const authApi = {
    login: (payload) => httpClient.post('/sessions', payload),
    signUp: (payload) => httpClient.post('/register', payload),
    logout: () =>httpClient.delete('sessions/current')
};

export default authApi;