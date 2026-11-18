import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, CheckCircle2, Clock3, Search, Users, XCircle } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import * as zod from "zod";
import api from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { dateAndTimeStringsToDate, formatDateTime } from "@/utils/date";
import { Link } from "react-router";
import usePageStore from "@/store/pageStore";

const pageStore = usePageStore.getState();

const availabilitySchema = zod.object({
  date: zod.iso.date("Choose a valid date."),
  time: zod.iso.time("Choose a valid start time."),
  partySize: zod.coerce.number()
    .int("Party size must be a whole number.")
    .min(1, "Enter at least 1 person."),
});

function getLocalDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function PageAvailability() {
  const [result, setResult] = useState(null);
  const [reservData, setReservData] = useState(null);
  const form = useForm({
    resolver: zodResolver(availabilitySchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      date: getLocalDateValue(),
      time: "",
      partySize: "1",
    },
  });

  const { control, handleSubmit, formState } = form;

  async function handleCheckAvailability(values) {
    const requestedDateTime = dateAndTimeStringsToDate(values.date, values.time);
	  const requestedPartySize = values.partySize;
    const requestedStart = requestedDateTime.toISOString();
    const requestedFormattedStart = formatDateTime(requestedDateTime);
    setResult(null);

    try {
      const response = await api.timeslots.checkAvailability({
        start: requestedStart,
        partySize: requestedPartySize,
      });

      if (response?.success && response.data) {
        setResult({ kind: "checked", data: response.data, formattedStart: requestedFormattedStart, partySize: values.partySize });
        setReservData({
          startDateTime: requestedDateTime,
          endDateTime: requestedDateTime,
          partySize: requestedPartySize
        });
	  } else if (response?.status === 404) {
        setResult({ kind: "missing", formattedStart: requestedFormattedStart });
      } else {
        setResult({ kind: "error" });
      }
    } catch {
      setResult({ kind: "error" });
    }
  }

  const allocations = result?.kind === "checked" && result.data.available
    ? result.data.tables ?? []
    : [];

  return (
    <section className="mx-auto max-w-3xl py-8">
      <Card className="border-white/70 bg-card/95 shadow-xl shadow-black/5 backdrop-blur-sm">
        <CardHeader>
          <div className="mb-1 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Search aria-hidden="true" className="size-5" />
          </div>
          <CardTitle>Check table availability</CardTitle>
          <CardDescription>
            Choose a meal time and party size to see whether there are enough seats, and how your group can be seated.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(handleCheckAvailability)}>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                  name="date"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="availability-date"><CalendarDays aria-hidden="true" className="size-4" />Date</FieldLabel>
                      <Input
                        {...field}
                        id="availability-date"
                        type="date"
                        disabled={formState.isSubmitting}
                        aria-invalid={fieldState.invalid}
                        onChange={(event) => {
                          field.onChange(event);
                          setResult(null);
                        }}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />

                <Controller
                  name="time"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="availability-time"><Clock3 aria-hidden="true" className="size-4" />Start time</FieldLabel>
                      <Input
                        {...field}
                        id="availability-time"
                        type="time"
                        disabled={formState.isSubmitting}
                        aria-invalid={fieldState.invalid}
                        onChange={(event) => {
                          field.onChange(event);
                          setResult(null);
                        }}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </div>

              <Controller
                name="partySize"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="availability-party-size"><Users aria-hidden="true" className="size-4" />Party size</FieldLabel>
                    <Input
                      {...field}
                      id="availability-party-size"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      value={field.value ?? ""}
                      disabled={formState.isSubmitting}
                      aria-invalid={fieldState.invalid}
                      onChange={(event) => {
                        field.onChange(event.target.value);
                        setResult(null);
                      }}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              <Button type="submit" size="lg" className="w-full rounded-xl" disabled={formState.isSubmitting}>
                <Search aria-hidden="true" />
                {formState.isSubmitting ? "Checking availability…" : "Check availability"}
              </Button>
            </FieldGroup>
          </form>

          {result && (
            <section className="mt-6" aria-live="polite">
              {result.kind === "checked" && result.data.available ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                    <div className="min-w-0 space-y-1">
                      <h2 className="font-semibold">A table is available</h2>
                      <p className="text-sm text-muted-foreground">
                        {result.partySize} {result.partySize === 1 ? "person can" : "people can"} be seated at {result.formattedStart}.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-primary/15 pt-4">
                    <p className="text-sm font-medium">Suggested table arrangement</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {allocations.map((table) => table.seatsToTake).join(" + ")} seats across {allocations.length} {allocations.length === 1 ? "table" : "tables"}
                    </p>
                    <ul className="mt-3 flex flex-wrap gap-2" aria-label="Seats assigned per table">
                      {allocations.map((table) => (
                        <li key={table.tableNumber} className="rounded-lg border bg-background px-3 py-2 text-sm">
                          <span className="font-medium">Table {table.tableNumber}</span>
                          <span className="ml-2 text-muted-foreground">
                            {table.seatsToTake} {table.seatsToTake === 1 ? "seat" : "seats"}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {result.data.freeSeats} {result.data.freeSeats === 1 ? "seat is" : "seats are"} currently free in total.
                    </p>
                  </div>

                  <Button asChild type="submit" size="lg" className="w-full rounded-xl mt-4" disabled={formState.isSubmitting}>
                    <Link to="/reservations" viewTransition onClick={() => {
                      // set reservation data
                      pageStore.setPageData("/reservations", reservData);
                      // console.log("Button clicked");
                      // console.log(reservData);
                    }} >Make a reservation!</Link>
                  </Button>
                </div>
				
              ) : result.kind === "checked" ? (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5" role="status">
                  <div className="flex items-start gap-3">
                    <XCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
                    <div className="space-y-1">
                      <h2 className="font-semibold">Not available for this party size</h2>
                      <p className="text-sm text-muted-foreground">
                        {result.data.freeSeats} {result.data.freeSeats === 1 ? "seat is" : "seats are"} currently free at {result.formattedStart}.
                        Try checking another date or time.
                      </p>
                    </div>
                  </div>
                </div>
              ) : result.kind === "missing" ? (
                <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground" role="status">
                  No service starts at {result.formattedStart}. Try another date or time.
                </p>
              ) : (
                <p className="rounded-xl border border-dashed p-5 text-center text-sm text-destructive" role="alert">
                  Availability could not be checked. Please try again.
                </p>
              )}
            </section>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export default PageAvailability;
