import { Outlet } from "react-router";
import Navbar from "@/components/partial/navbar";

function LayoutDefault({ className, ...props }) {
    return (
        <>

            <Navbar />
            <main className='max-w-screen-2xl mx-auto pt-24 pb-4 px-4'>
                <Outlet />
            </main>

        </>
    );
}

export default LayoutDefault;