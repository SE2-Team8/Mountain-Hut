import httpClient from "@/lib/http-client";

const authApi = {
    login: (payload) => httpClient.post('/sessions', payload),
    signUp: (payload) => httpClient.post('/register', payload),
    getCurrentSession: () => httpClient.get('/sessions/current', {}, {silent: true}),
    logout: () => httpClient.delete('sessions/current'),
};

export default authApi;