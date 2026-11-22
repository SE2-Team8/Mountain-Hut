import { useState, useEffect, useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, CheckCircle2, Clock3, Search, Users, XCircle } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import * as zod from "zod";
import api from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatDateTime, getLocalDateValue } from "@/utils/date";
import { Link } from "react-router";

const availabilitySchema = zod.object({
  date: zod.iso.date("Choose a valid date."),
  timeSlotId: zod.string().min(1, "Choose a time slot.").transform(Number),
  partySize: zod.coerce.number()
    .int("Party size must be a whole number.")
    .min(1, "Enter at least 1 person."),
});

function PageAvailability() {
  const [result, setResult] = useState(null);
  const [dayAvailability, setDayAvailability] = useState({ date: null, slots: [], error: false });
  const [loadingSlots, setLoadingSlots] = useState(false);

  const form = useForm({
    resolver: zodResolver(availabilitySchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      date: getLocalDateValue(),
      timeSlotId: "",
      partySize: 1,
    },
  });

  const { control, handleSubmit, formState, setValue } = form;
  const date = useWatch({ control, name: "date" });
  const timeSlotId = useWatch({ control, name: "timeSlotId" });
  const slots = dayAvailability.slots ?? [];
  const dateIsValid = date && !Number.isNaN(new Date(date).getTime());

  const fetchAvailability = useCallback(async (selectedDate, isCurrent = () => true) => {
    setLoadingSlots(true);
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    try {
      const response = await api.timeslots.getAll({
        from: startOfDay.toISOString(),
        to: endOfDay.toISOString(),
      });

      if (!isCurrent()) return;

      if (response?.success && Array.isArray(response.data)) {
        setDayAvailability({ date: selectedDate, slots: response.data, error: false });
      } else {
        setDayAvailability({ date: selectedDate, slots: [], error: true });
      }
    } catch {
      if (isCurrent()) setDayAvailability({ date: selectedDate, slots: [], error: true });
    } finally {
      if (isCurrent()) setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    setValue("timeSlotId", "");
    setResult(null);

    if (dateIsValid) {
      let active = true;
      fetchAvailability(date, () => active);
      return () => { active = false; };
    }
  }, [date, dateIsValid, fetchAvailability, setValue]);

  async function handleCheckAvailability(values) {
	  const requestedPartySize = values.partySize;
    setResult(null);
    const selectedSlot = slots.find((s) => s.timeSlotId === values.timeSlotId);
    if (!selectedSlot) return;

    const requestedStart = selectedSlot.startDateTime;
    const requestedFormattedStart = formatDateTime(new Date(requestedStart));

    try {
      const response = await api.timeslots.checkAvailability({
        start: requestedStart,
        partySize: requestedPartySize,
      });

      if (response?.success && response.data) {
        setResult({
          kind: "checked",
          data: response.data,
          formattedStart: requestedFormattedStart,
          startDateTime: requestedStart,
          timeSlotId: response.data.timeSlotId,
          partySize: requestedPartySize,
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
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              <Controller
                name="timeSlotId"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="mt-2">
                    <FieldLabel>Available slots</FieldLabel>
                    
                    {!dateIsValid ? (
                      <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                        Choose a valid date.
                      </p>
                    ) : loadingSlots ? (
                      <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                        Loading available times...
                      </p>
                    ) : dayAvailability.error ? (
                      <p className="rounded-xl border border-dashed p-4 text-center text-sm text-destructive">
                        Could not load timeslots.
                      </p>
                    ) : slots.length === 0 ? (
                      <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                        No slots available on this date.
                      </p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2 mt-2">
                        {slots.map((slot) => {
                          const isSelected = String(field.value) === String(slot.timeSlotId);
                          return (
                            <Button
                              key={slot.timeSlotId}
                              type="button"
                              variant={isSelected ? "default" : "outline"}
                              className="h-auto min-h-14 justify-between px-4 py-2 text-left"
                              onClick={() => {
                                field.onChange(String(slot.timeSlotId));
                                setResult(null);
                              }}
                            >
                              <span className="font-semibold">{formatDateTime(new Date(slot.startDateTime))}</span>
                              <span className="text-xs">{slot.freeSeats} seats</span>
                            </Button>
                          );
                        })}
                      </div>
                    )}
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

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

                      disabled={formState.isSubmitting || !timeSlotId}
                      aria-invalid={fieldState.invalid}
                      onChange={(event) => {
                        field.onChange(event.target.value === "" ? "" : Number(event.target.value));
                        setResult(null);
                      }}
                    />
                    {!timeSlotId && (
                      <p className="text-sm text-muted-foreground">Choose a time slot first</p>
                    )}
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              <Button 
                type="submit" 
                size="lg" 
                className="w-full rounded-xl mt-4" 
                disabled={formState.isSubmitting || !timeSlotId}
              >
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
                    <Link
                      to={`/reservations/new?${new URLSearchParams({
                        start: result.startDateTime,
                        timeSlotId: String(result.timeSlotId),
                        partySize: String(result.partySize),
                      })}`}
                      viewTransition
                    >
                      Make a reservation!
                    </Link>
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
