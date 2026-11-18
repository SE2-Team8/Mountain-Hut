import LayoutAuth from "@/layouts/auth";
import LayoutDefault from "@/layouts/default";
import LayoutError from "@/layouts/error";
import PageIndex from "@/pages";
import Page404 from "@/pages/404";
import PageLogin from "@/pages/login";
import PageReservations from "@/pages/reservations";
import PageCapacity from "@/pages/capacity";
import PageAvailability from "@/pages/availability";
import PageSignUp from "@/pages/signup";
import useUserStore from "@/store/user";
import { createBrowserRouter } from "react-router";
import auth from "@/middlewares/auth";
import PageInspectReservation from "@/pages/inspectReservation";

const router = createBrowserRouter([
    {
        Component: LayoutDefault,
        loader: async() =>{
            await useUserStore.getState().getAuthenticatedUser();
            return null
        },
        HydrateFallback: () => (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <p className="text-muted-foreground font-medium animate-pulse">Loading app...</p>
            </div>
        ),
        children: [
            {
                index: true,
                Component: PageIndex,
                //middleware: [auth],
            },
            {
                path: 'availability',
                Component: PageAvailability,
            },
            {
                path: 'reservations',
                Component: PageReservations,
                middleware: [auth],
            },
            {
                path: 'reservations/:reservation_id',
                Component: PageInspectReservation,
                middleware: [auth],
            },
            {
                path: 'capacity',
                Component: PageCapacity,
                middleware: [auth],
            },
        ]
    },

    {
        Component: LayoutAuth,
        children: [
            {
                path: 'auth/login',
                Component: PageLogin
            },
            {
                path: 'auth/signup',
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
