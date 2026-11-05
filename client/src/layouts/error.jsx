import { cn } from "@/lib/utils";
import { Outlet } from "react-router";

function LayoutError({ className, ...props }) {
    return (
        <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
            <div className="max-w-screen-2xl mx-auto">
                <div className={cn("flex flex-col gap-6", className)} {...props}>
                    <Outlet />
                </div>
            </div>
        </div>
    );
}

export default LayoutError;