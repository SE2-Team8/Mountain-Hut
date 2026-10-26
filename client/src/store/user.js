import { create } from "zustand";

const useUserStore = create((set, get) => ({
    user: null,
    setUser: (payload) => { set({ user: payload }); },
    getUser: () => get().user,
}));

export default useUserStore;