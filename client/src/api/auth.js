import httpClient from "@/lib/http-client";

const authApi = {
    login: (payload) => httpClient.post('/auth/login', payload),
    signUp: (payload) => httpClient.post('/auth/register', payload),
    getCurrentSession: () => httpClient.get('/auth/me', {}, {silent: true}),
    logout: () => httpClient.post('/auth/logout'),
    setupPassword: (payload) => httpClient.post('/auth/setup-password', payload),
};

export default authApi;
