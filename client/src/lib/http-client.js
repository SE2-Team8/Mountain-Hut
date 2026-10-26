import axios from "axios";
import { redirect } from "react-router";
import { toast } from "sonner";

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_BASE_API,
    withCredentials: true
});

function handleError(error) {
    switch (error.response?.status) {
        case 401:
            toast.error(error.response?.data?.message || "401 Unauthorized");
            return redirect("/auth/login");

        case 403:
            toast.error(error.response?.data?.message || "403 Forbidden");

            break;
        case 422:
            const data = error.response.data.data || [];

            data.forEach((item) => { toast.error(item.msg); });

            break;
        default:
            toast.error(error.response?.data?.message || "An unknown error occurred.");

            break;
    }
};

const httpClient = {
    get: async (endpoint, params = {}) => {
        try {
            const response = await axiosInstance.get(endpoint, { params });

            return response.data;
        } catch (error) {
            handleError(error);

            return error;
        }
    },
    post: async (endpoint, data) => {
        try {
            const response = await axiosInstance.post(endpoint, data);

            return response.data;
        } catch (error) {
            handleError(error);

            return error;
        }
    },
    put: async (endpoint, data) => {
        try {
            const response = await axiosInstance.put(endpoint, data);

            return response.data;
        } catch (error) {
            handleError(error);

            return error;
        }
    },
    delete: async (endpoint) => {
        try {
            const response = await axiosInstance.delete(endpoint);

            return response.data;
        } catch (error) {
            handleError(error);

            return error;
        }
    }
};

export default httpClient;