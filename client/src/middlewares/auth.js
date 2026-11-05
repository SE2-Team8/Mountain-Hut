import useUserStore from "@/store/user";
import { redirect } from "react-router";
async function auth(_, next) {

        const user = await useUserStore.getState().getAuthenticatedUser();
        if (!user) throw redirect("/auth/login");
        await next();
}

export default auth;