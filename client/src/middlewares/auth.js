import useUserStore from "@/store/user";
import { redirect } from "react-router";

async function auth({ request }, next) {
	const user = await useUserStore.getState().getAuthenticatedUser();

	if (!user) {
		const requestedUrl = new URL(request.url);
		const loginUrl = new URL("/auth/login", requestedUrl);

		loginUrl.searchParams.set(
			"returnTo",
			`${requestedUrl.pathname}${requestedUrl.search}${requestedUrl.hash}`
		);

		throw redirect(`${loginUrl.pathname}${loginUrl.search}`);
	}
	await next();
}

export default auth;
