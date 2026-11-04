import { Link } from "react-router";
import { ArrowRight, CalendarCheck, ClipboardList, LogIn, Mountain, Users, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import useUserStore from "@/store/user";

const FEATURES = [
    {
        icon: Utensils,
        title: "Meals at the hut",
        text: "Simple, hearty food and drink, served at set times throughout the day.",
    },
    {
        icon: Users,
        title: "Shared tables",
        text: "Tables are shared, and your party is kept together whenever the seats allow it.",
    },
    {
        icon: CalendarCheck,
        title: "Plan with confidence",
        text: "Check the open time slots and book up to 2 hours before the meal.",
    },
];

const STAFF_ACTIONS = [
    {
        to: "/capacity",
        icon: ClipboardList,
        title: "Define time slots & tables",
        text: "Create a service slot and set its tables and seats, or copy the setup of a previous slot.",
    },
];

const heroButton = "w-full sm:w-48";

function PageIndex() {
    const user = useUserStore((state) => state.user);
    const isStaff = user?.role === "EMPLOYEE" || user?.role === "WARDEN";
    const firstName = user?.fullName?.split(" ")[0];

    return (
        <div className="mx-auto max-w-5xl space-y-12 py-12">
            <section className="space-y-6 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Mountain className="size-7" aria-hidden="true" />
                </div>
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                    {user ? `Welcome back, ${firstName}` : "Your table at the mountain hut"}
                </h1>
                <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                    {isStaff
                        ? "Everything you need to run the hut's meal service, in one place."
                        : "Reserve a seat for your meal and keep the hut team up to date, whatever the mountain has in store for you."}
                </p>

                {!isStaff && (
                    <div className="mx-auto flex max-w-md flex-col items-stretch justify-center gap-3 sm:max-w-none sm:flex-row sm:items-center">
                        <Button size="lg" className={heroButton} asChild>
                            <Link to="/reservations" viewTransition><CalendarCheck />Book a table</Link>
                        </Button>
                        {!user && (
                            <Button size="lg" variant="outline" className={heroButton} asChild>
                                <Link to="/auth/login" viewTransition><LogIn />Login</Link>
                            </Button>
                        )}
                    </div>
                )}
            </section>

            {isStaff ? (
                <section className="flex flex-wrap justify-center gap-4">
                    {STAFF_ACTIONS.map(({ to, icon: Icon, title, text }) => (
                        <Card key={to} className="flex w-full max-w-sm flex-col">
                            <CardHeader className="flex-1">
                                <Icon className="mb-2 size-6 text-primary" aria-hidden="true" />
                                <CardTitle>{title}</CardTitle>
                                <CardDescription>{text}</CardDescription>
                            </CardHeader>
                            <div className="px-6 pb-6">
                                <Button className="w-full" asChild>
                                    <Link to={to} viewTransition>Open<ArrowRight /></Link>
                                </Button>
                            </div>
                        </Card>
                    ))}
                </section>
            ) : (
                <section className="grid gap-4 sm:grid-cols-3">
                    {FEATURES.map(({ icon: Icon, title, text }) => (
                        <Card key={title}>
                            <CardHeader>
                                <Icon className="mb-2 size-6 text-primary" aria-hidden="true" />
                                <CardTitle>{title}</CardTitle>
                                <CardDescription>{text}</CardDescription>
                            </CardHeader>
                        </Card>
                    ))}
                </section>
            )}
        </div>
    );
}

export default PageIndex;