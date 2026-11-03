import { create } from "zustand";
import api from "@/api";

const useUserStore = create((set, get) => ({
    user: null,
    initialized: false, 

    setUser: (user) => set({ user, initialized: true }),
    getUser: () => get().user,

    getAuthenticatedUser: async () => {
        if (get().initialized) return get().user;

        const response = await api.auth.getCurrentSession();
        const user = response?.success ? response.data?.fullName : null;

        set({ user, initialized: true });
        return user;
    },
}));

export default useUserStore;

