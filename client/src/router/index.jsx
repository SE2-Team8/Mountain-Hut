import LayoutAuth from "@/layouts/auth";
import LayoutDefault from "@/layouts/default";
import LayoutError from "@/layouts/error";
import PageIndex from "@/pages";
import Page404 from "@/pages/404";
import PageLogin from "@/pages/login";
import PageSignUp from "@/pages/signup"
import { createBrowserRouter } from "react-router";

const router = createBrowserRouter([
    {
        Component: LayoutDefault,
        HydrateFallback: () => (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <p className="text-muted-foreground font-medium animate-pulse">Loading app...</p>
            </div>
        ),
        children: [
            {
                index: true,
                Component: PageIndex,
                // Once you have completed the auth middleware, you can use it like this:
                // middleware: [auth],
            },
        ]
    },
    {
        path: '/auth',
        Component: LayoutAuth,
        children: [
            {
                path: 'login',
                Component: PageLogin
            },
            {
                path: 'signup',
                Component: PageSignUp
            }
        ]
    },
    {
        Component: LayoutError,
        children: [
            {
                path: '*',
                Component: Page404
            }
        ]
    }
]);

export default router;