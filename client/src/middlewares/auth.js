import usePageStore from "@/store/pageStore";
import useUserStore from "@/store/user";
import { redirect } from "react-router";
function auth(comingFrom) {
	return async (_, next) => {
		// console.log("Location from middleware: ", comingFrom);
		if (comingFrom) {
			usePageStore.getState().setPageData("/auth/login", {comingFrom: comingFrom})
		}
        const user = await useUserStore.getState().getAuthenticatedUser();
        if (!user) throw redirect("/auth/login");
        await next();
	}
}

export default auth;