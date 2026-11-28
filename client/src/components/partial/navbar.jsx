import logoOnLight from '@/assets/img/LogoName_removed.png';
import logoOnDark from '@/assets/img/LogoName_removed_white.png';
import { Link, useLocation, useNavigate, NavLink } from "react-router";
import { useState } from "react";
import api from '@/api'
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { Button } from "@/components/ui/button";
import useUserStore from '@/store/user';
import { Dialog } from 'radix-ui';
import { LogIn, LogOut, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLE_LABELS = { HIKER: "Hiker", EMPLOYEE: "Employee", WARDEN: "Warden" };

const linkClass = ({ isActive }) => cn(
    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
    isActive
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
);

function Navbar() {
    const location = useLocation();
    const navigate = useNavigate();
    const user = useUserStore((state) => state.user)
    const setUser = useUserStore((state) => state.setUser)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const isStaff = user?.role === 'EMPLOYEE' || user?.role === 'WARDEN';

    const links = [
        { to: "/", label: "Home", end: true },
        ...(!isStaff ? [{ to: "/availability", label: "Availability" }] : []),
        ...(user && !isStaff ? [{ to: "/reservations", label: "My Reservations" }] : []),
        ...(isStaff ? [{ to: "/capacity", label: "Define capacity" }] : []),
        ...(isStaff ? [{ to: "/reservations/book-for-hiker", label: "Book for a hiker"}] : []),
        ...(isStaff ? [{ to: "/hikers/new", label: "New hiker"}] : []),
    ];

    async function handleLogout() {
        await api.auth.logout();
        setUser(null)
        setMobileMenuOpen(false);
        navigate('/')
    }

    return (
        <Dialog.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <nav className="sticky top-0 z-20 w-full border-b bg-background/90 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-3 px-4 sm:gap-4 md:grid md:grid-cols-[1fr_auto_1fr]">
                    <Link to="/" className="flex min-w-0 items-center justify-self-start" viewTransition>
                        <img src={logoOnLight} className="h-8 w-auto max-w-[52vw] dark:hidden sm:h-9" alt="Mountain Hut" />
                        <img src={logoOnDark} className="hidden h-8 w-auto max-w-[52vw] dark:block sm:h-9" alt="Mountain Hut" />
                    </Link>

                    <NavigationMenu className="hidden flex-none md:flex">
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

                    <div className="hidden items-center justify-self-end gap-3 md:flex">
                        {user ? (
                            <>
                                <div className="hidden text-right leading-tight lg:block">
                                    <p className="text-sm font-medium">{user.fullName}</p>
                                    <p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role] ?? user.role}</p>
                                </div>
                                <Button size="sm" variant="outline" onClick={handleLogout}>
                                    <LogOut />Logout
                                </Button>
                            </>
                        ) : (
                            location.pathname !== '/auth/login' && (
                                <Button size="sm" asChild>
                                    <Link to="/auth/login" viewTransition><LogIn />Login</Link>
                                </Button>
                            )
                        )}
                    </div>

                    <Dialog.Trigger asChild>
                        <Button
                            className="justify-self-end md:hidden"
                            size="icon-lg"
                            variant="ghost"
                            aria-label="Open navigation menu"
                        >
                            <Menu aria-hidden="true" />
                        </Button>
                    </Dialog.Trigger>
                </div>
            </nav>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out motion-reduce:animate-none" />
                <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex h-dvh w-[min(88vw,24rem)] flex-col gap-6 border-l bg-background p-5 shadow-xl duration-300 ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right-full data-[state=closed]:slide-out-to-right-full motion-reduce:animate-none">
                    <div className="flex items-center justify-between gap-4">
                        <Dialog.Title className="text-lg font-semibold">Mountain Hut</Dialog.Title>
                        <Dialog.Close asChild>
                            <Button size="icon-lg" variant="ghost" aria-label="Close navigation menu">
                                <X aria-hidden="true" />
                            </Button>
                        </Dialog.Close>
                    </div>

                    {user && (
                        <div className="rounded-lg bg-muted/70 px-4 py-3">
                            <p className="font-medium">{user.fullName}</p>
                            <p className="text-sm text-muted-foreground">{ROLE_LABELS[user.role] ?? user.role}</p>
                        </div>
                    )}

                    <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
                        {links.map((link) => (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                end={link.end}
                                viewTransition
                                onClick={() => setMobileMenuOpen(false)}
                                className={({ isActive }) => cn(
                                    "rounded-lg px-4 py-3 text-base font-medium transition-colors",
                                    isActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                {link.label}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="mt-auto border-t pt-4">
                        {user ? (
                            <Button className="w-full justify-start" variant="outline" onClick={handleLogout}>
                                <LogOut />Logout
                            </Button>
                        ) : (
                            location.pathname !== '/auth/login' && (
                                <Button className="w-full justify-start" asChild>
                                    <Link to="/auth/login" viewTransition onClick={() => setMobileMenuOpen(false)}>
                                        <LogIn />Login
                                    </Link>
                                </Button>
                            )
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

export default Navbar;
