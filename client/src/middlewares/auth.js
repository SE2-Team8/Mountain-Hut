async function auth({ context }, next) {

    /* 
    Write actual auth logic here(I wrote `await next();` temporarily to pass the authectication).
    For example, if you are using jwt token saved in user store, it would be something like this:
        const user = await useUserStore.getState().getAuthenticatedUser();

        if (!user) throw redirect("/auth/login");

        await next();
     */

    await next();
}

export default auth;