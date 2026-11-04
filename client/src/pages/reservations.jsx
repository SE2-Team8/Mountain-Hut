import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Clock3, Users } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import * as zod from "zod";
import { toast } from "sonner";
import api from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/utils/date";

const RESERVATION_CUTOFF_MS = 2 * 60 * 60 * 1000;
const EMPTY_SLOTS = Object.freeze([]);

function toDateTimeLocal(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 19);
}

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 0);

  return {
    from: toDateTimeLocal(start),
    to: toDateTimeLocal(end),
  };
}

function isValidRange(from, to) {
  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime();

  return Number.isFinite(fromTime) && Number.isFinite(toTime) && fromTime <= toTime;
}

function isBookable(slot) {
  return Number(slot.freeSeats) > 0
    && new Date(slot.startDateTime).getTime() - Date.now() >= RESERVATION_CUTOFF_MS;
}

function PageReservations() {
  const [availability, setAvailability] = useState({ rangeKey: null, slots: [], error: false });
  const [loading, setLoading] = useState(true);
  const todayRange = getTodayRange();

  const formSchema = zod.object({
    from: zod.string().min(1, "Start date and time are required"),
    to: zod.string().min(1, "End date and time are required"),
    timeSlotId: zod.string().min(1, "Choose an available time slot").transform(Number),
    partySize: zod.coerce.number().int().min(1, "Enter at least 1 person"),
  }).superRefine((values, context) => {
    if (values.from && values.to && !isValidRange(values.from, values.to)) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "End date and time must be after the start",
      });
    }

    const selectedSlot = slots.find((slot) => slot.timeSlotId === values.timeSlotId);
    if (!selectedSlot) {
      if (values.timeSlotId) {
        context.addIssue({
          code: "custom",
          path: ["timeSlotId"],
          message: "That time slot is no longer available. Choose another slot.",
        });
      }
      return;
    }

    if (Number(selectedSlot.freeSeats) < 1) {
      context.addIssue({
        code: "custom",
        path: ["timeSlotId"],
        message: "This slot no longer has any seats available. Choose another slot.",
      });
    } else if (values.partySize > Number(selectedSlot.freeSeats)) {
      context.addIssue({
        code: "custom",
        path: ["partySize"],
        message: `Only ${selectedSlot.freeSeats} ${Number(selectedSlot.freeSeats) === 1 ? "seat is" : "seats are"} available for this time`,
      });
    }

    if (Number(selectedSlot.freeSeats) > 0 && !isBookable(selectedSlot)) {
      context.addIssue({
        code: "custom",
        path: ["timeSlotId"],
        message: "Reservations must be made at least 2 hours before the slot",
      });
    }
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      ...todayRange,
      timeSlotId: "",
      partySize: 1,
    },
  });

  const { handleSubmit, setValue, trigger, control, formState } = form;
  const from = useWatch({ control, name: "from" });
  const to = useWatch({ control, name: "to" });
  const timeSlotId = useWatch({ control, name: "timeSlotId" });
  const rangeKey = JSON.stringify([from, to]);
  const rangeIsValid = isValidRange(from, to);
  const rangeAvailability = availability.rangeKey === rangeKey ? availability : null;
  const slots = rangeAvailability?.slots ?? EMPTY_SLOTS;
  const availabilityError = rangeAvailability?.error ?? false;
  const isLoading = rangeIsValid && (loading || !rangeAvailability);
  const selectedSlot = slots.find((slot) => slot.timeSlotId === Number(timeSlotId));
  const bookableSlots = slots.filter(isBookable);

  const fetchAvailability = useCallback(async (rangeStart, rangeEnd, isCurrent = () => true) => {
    setLoading(true);
    const requestRangeKey = JSON.stringify([rangeStart, rangeEnd]);

    try {
      const response = await api.timeslots.getAll({
        from: new Date(rangeStart).toISOString(),
        to: new Date(rangeEnd).toISOString(),
      });

      if (!isCurrent()) return response;

      if (response?.success && Array.isArray(response.data)) {
        setAvailability({ rangeKey: requestRangeKey, slots: response.data, error: false });
      } else {
        setAvailability({ rangeKey: requestRangeKey, slots: [], error: true });
      }

      return response;
    } catch {
      if (isCurrent()) setAvailability({ rangeKey: requestRangeKey, slots: [], error: true });
      return null;
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setValue("timeSlotId", "");
    setValue("partySize", 1);

    if (rangeIsValid) {
      let active = true;
      Promise.resolve().then(() => {
        if (active) fetchAvailability(from, to, () => active);
      });

      return () => {
        active = false;
      };
    }
  }, [fetchAvailability, from, rangeIsValid, setValue, to]);

  useEffect(() => {
    if (timeSlotId && !loading) trigger(["timeSlotId", "partySize"]);
  }, [loading, slots, timeSlotId, trigger]);

  function handleSelectSlot(slot, field) {
    field.onChange(String(slot.timeSlotId));
    trigger("partySize");
  }

  async function handleReservation(data) {
    const response = await api.timeslots.reserve({
      timeSlotId: data.timeSlotId,
      partySize: data.partySize,
    });

    if (response?.success) {
      toast.success("Reservation confirmed!");
      setValue("timeSlotId", "");
      setValue("partySize", 1);
    }

    await fetchAvailability(from, to);
  }

  return (
    <section className="mx-auto max-w-3xl py-8">
      
      <Card className="border-white/70 bg-card/95 shadow-xl shadow-black/5 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Reservation details</CardTitle>
          <CardDescription>
            Pick a time range to see open slots. Reservations must be made at least 2 hours ahead.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(handleReservation)}>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                  name="from"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="reservation-from">From</FieldLabel>
                      <Input
                        {...field}
                        id="reservation-from"
                        type="datetime-local"
                        step="1"
                        disabled={formState.isSubmitting}
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />

                <Controller
                  name="to"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="reservation-to">To</FieldLabel>
                      <Input
                        {...field}
                        id="reservation-to"
                        type="datetime-local"
                        step="1"
                        min={from || undefined}
                        disabled={formState.isSubmitting}
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </div>

              <Controller
                name="timeSlotId"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <FieldLabel>Available times</FieldLabel>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {isLoading ? "Checking availability…" : `${bookableSlots.length} open ${bookableSlots.length === 1 ? "slot" : "slots"}`}
                        </p>
                      </div>
                      <Clock3 aria-hidden="true" className="mb-1 size-5 text-muted-foreground" />
                    </div>

                    {!rangeIsValid ? (
                      <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                        Choose a valid date and time range to see available slots.
                      </p>
                    ) : isLoading ? (
                      <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground" role="status">
                        Loading available times…
                      </p>
                    ) : availabilityError ? (
                      <p className="rounded-xl border border-dashed p-5 text-center text-sm text-destructive" role="alert">
                        Availability could not be loaded. Please adjust the range or try again.
                      </p>
                    ) : bookableSlots.length === 0 ? (
                      <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                        No bookable slots in this range. Try another date or time.
                      </p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {bookableSlots.map((slot) => {
                          const isSelected = Number(field.value) === slot.timeSlotId;

                          return (
                            <Button
                              key={slot.timeSlotId}
                              type="button"
                              variant={isSelected ? "default" : "outline"}
                              className="h-auto min-h-16 justify-between gap-3 whitespace-normal rounded-xl px-4 py-3 text-left"
                              aria-pressed={isSelected}
                              disabled={formState.isSubmitting}
                              onClick={() => handleSelectSlot(slot, field)}
                            >
                              <span className="flex flex-col items-start gap-1">
                                <span className="font-semibold">{formatDateTime(slot.startDateTime)}</span>
                                <span className={isSelected ? "text-primary-foreground/75" : "text-muted-foreground"}>
                                  until {formatDateTime(slot.endDateTime)}
                                </span>
                              </span>
                              <span className="shrink-0 text-xs font-medium">
                                {slot.freeSeats} {Number(slot.freeSeats) === 1 ? "seat" : "seats"}
                              </span>
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
                    <FieldLabel htmlFor="party-size">Party size</FieldLabel>
                    <div className="relative">
                      <Users aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        {...field}
                        id="party-size"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        value={field.value ?? ""}
                        disabled={!selectedSlot || formState.isSubmitting}
                        className="pl-10"
                        onChange={(event) => field.onChange(event.target.value === "" ? "" : Number(event.target.value))}
                        aria-invalid={fieldState.invalid}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedSlot
                        ? `${selectedSlot.freeSeats} ${Number(selectedSlot.freeSeats) === 1 ? "seat is" : "seats are"} available for this time`
                        : "Choose a time slot first"}
                    </p>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              <Button
                type="submit"
                size="lg"
                className="w-full rounded-xl"
                disabled={formState.isSubmitting || isLoading}
              >
                {formState.isSubmitting ? "Reserving…" : "Confirm reservation"}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}

export default PageReservations;
