import logo from '@/assets/img/LogoName.png';
import { Link, useLocation } from "react-router";
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { Button } from "@/components/ui/button";

function Navbar({ className, ...props }) {
    const location = useLocation(); 
    return (
        <nav className="bg-background fixed w-full z-20 top-0 start-0 border-b border-default">
            <div className="flex flex-wrap justify-around mx-0 p-4">

                <Link to="/" className="flex items-center  space-x-3" viewTransition>
                    <img src={logo} className="h-30" alt="Logo" />
                </Link>
                <NavigationMenu>
                    <NavigationMenuList>

                        <NavigationMenuItem>
                            <Button variant='secondary' size='lg' className="font-semibold text-green-800" asChild>
                                {location.pathname !== '/' && <Link to="/" viewTransition>Home</Link>}
                            </Button>
                        </NavigationMenuItem>

                        <NavigationMenuItem>
                        <Button variant='secondary' size='lg' className="font-semibold text-green-800" asChild>
                        {location.pathname !== '/auth/login' && <Link to="/auth/login" viewTransition>Login</Link>}
                        </Button>
                        </NavigationMenuItem>

                        </NavigationMenuList>
                </NavigationMenu>


            </div>
        </nav>
    )
}

export default Navbar;