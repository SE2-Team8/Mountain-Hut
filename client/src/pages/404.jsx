import { Button } from "@/components/ui/button";
import { Link } from "react-router";

function Page404() {
    return (
        <>
            <div className="text-center">
                <p className="font-semibold text-indigo-400 mb-2">404</p>
                <h1 className="font-semibold tracking-tight text-balance text-white text-4xl mb-2">Page Not Found</h1>
                <p className="text-lg text-neutral-400 mb-6">Sorry, we couldn’t find the page you’re looking for.</p>
                <Button asChild>
                    <Link to="/" viewTransition>Back To Home</Link>
                </Button>

            </div>
        </>
    );
}

export default Page404;