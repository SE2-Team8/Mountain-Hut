import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { CalendarDays, ChevronRight } from "lucide-react";
import api from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/utils/date";

function PageMyReservations() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadReservations = useCallback(async (isCurrent = () => true) => {
    try {
      const response = await api.reservations.getAll();

      if (!isCurrent()) return;

      if (response?.success && Array.isArray(response.data)) {
        setReservations(response.data);
        setError(false);
      } else if (response?.response?.status === 404) {
        setReservations([]);
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      if (isCurrent()) setError(true);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadReservations(() => active);

    return () => {
      active = false;
    };
  }, [loadReservations]);

  return (
    <section className="mx-auto max-w-3xl space-y-6 py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">My Reservations</h1>
          <p className="text-muted-foreground">Review your upcoming and past reservations.</p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link to="/reservations/new" viewTransition>Book a table</Link>
        </Button>
      </header>

      {loading ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground" role="status">
          Loading your reservations…
        </p>
      ) : error ? (
        <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center text-destructive" role="alert">
          Your reservations could not be loaded. Please try again.
        </p>
      ) : reservations.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <CalendarDays className="mb-2 size-8 text-muted-foreground" aria-hidden="true" />
            <CardTitle>No reservations yet</CardTitle>
            <CardDescription>Your reservations will appear here after you book a table.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild>
              <Link to="/reservations/new" viewTransition>Make a reservation</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3" aria-label="Your reservations">
          {reservations.map((reservation) => {
            const dateTime = formatDateTime(reservation.startDateTime);

            return (
              <li key={reservation.reservId}>
                <Link
                  to={`/reservations/${reservation.reservId}`}
                  viewTransition
                  aria-label={`Review reservation ${reservation.reservId}, ${dateTime}`}
                  className="group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Card className="transition-colors group-hover:bg-muted/40 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                    <CardContent className="flex items-center justify-between gap-4">
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium">Reservation #{reservation.reservId}</p>
                        <p className="text-sm text-muted-foreground">{dateTime}</p>
                      </div>
                      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default PageMyReservations;
