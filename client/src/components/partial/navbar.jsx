import logo from '@/assets/img/logo.png';
import { Link } from "react-router";
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { Button } from "@/components/ui/button";

function Navbar({ className, ...props }) {
    return (
        <nav className="bg-background fixed w-full z-20 top-0 start-0 border-b border-default">
            <div className="max-w-screen-2xl flex flex-wrap items-center justify-between mx-auto p-4">

                <Link to="/" className="flex items-center space-x-3" viewTransition>

                    <img src={logo} className="h-7" alt="Logo" />
                    <span className="self-center text-xl text-heading font-semibold whitespace-nowrap">Mountain Hut</span>

                </Link>
                <NavigationMenu>
                    <NavigationMenuList>

                        <NavigationMenuItem>
                            <NavigationMenuLink asChild>
                                <Link to="/" viewTransition>Home</Link>
                            </NavigationMenuLink>
                        </NavigationMenuItem>
                        

                    </NavigationMenuList>
                </NavigationMenu>
                <Button asChild>
                    <Link to="/auth/login" viewTransition>Login</Link>
                </Button>

            </div>
        </nav>
    )
}

export default Navbar;