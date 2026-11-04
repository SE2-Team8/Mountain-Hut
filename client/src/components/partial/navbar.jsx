import logo from '@/assets/img/LogoName.png';
import { Link, useLocation, useNavigate, NavLink } from "react-router";
import api from '@/api'
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { Button } from "@/components/ui/button";
import useUserStore from '@/store/user';
import { LogIn, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLE_LABELS = { HIKER: "Hiker", EMPLOYEE: "Employee", WARDEN: "Warden" };

const linkClass = ({ isActive }) => cn(
    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
    isActive
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
);

function Navbar({ className, ...props }) {
    const location = useLocation(); 
    const navigate = useNavigate();
    const user = useUserStore((state)=>state.user)
    const setUser = useUserStore((state)=>state.setUser)

    const isStaff = user?.role === 'EMPLOYEE' || user?.role === 'WARDEN';

    const links = [
        { to: "/", label: "Home", end: true },
        ...(!isStaff ? [{ to: "/reservations", label: "Reservations" }] : []),
        ...(isStaff ? [{ to: "/capacity", label: "Define capacity" }] : []),
    ];
    
    async function handleLogout(){
        await api.auth.logout();
        setUser(null)
        navigate('/')
    }

    return (
        <nav className="sticky top-0 z-20 w-full border-b bg-background/90 backdrop-blur">
            <div className="mx-auto grid h-16 max-w-screen-2xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">

                <Link to="/" className="flex items-center justify-self-start" viewTransition>
                    <img src={logo} className="h-15 w-auto" alt="Mountain Hut" />
                </Link>

                <NavigationMenu className="flex-none">
                    <NavigationMenuList>
                        {links.map((link) => (
                            <NavigationMenuItem key={link.to}>
                                <NavigationMenuLink asChild>
                                    <NavLink to={link.to} end={link.end} className={linkClass} viewTransition>
                                        {link.label}
                                    </NavLink>
                                </NavigationMenuLink>
                            </NavigationMenuItem>
                        ))}
                    </NavigationMenuList>
                </NavigationMenu>

                <div className="flex items-center justify-self-end gap-3">
                    { user ? (
                        <>
                            <div className="hidden text-right leading-tight md:block">
                                <p className="text-sm font-medium">{user.fullName}</p>
                                <p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role] ?? user.role}</p>
                            </div>
                            <Button size='sm' variant='outline' onClick={handleLogout}>
                                <LogOut />Logout
                            </Button>
                        </>
                    ) : (
                        location.pathname !== '/auth/login' && (
                            <Button size= 'sm' asChild >
                                <Link to="/auth/login" viewTransition><LogIn />Login</Link>
                            </Button>
                        )
                    )}
                </div>
            </div>
        </nav>
    )
}

export default Navbar;
