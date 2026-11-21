import { useCallback, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Clock3, Users } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import * as zod from "zod";
import { toast } from "sonner";
import api from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatDateTime, getLocalDateValue } from "@/utils/date";
import { useNavigate, useSearchParams } from "react-router";
import { RequirementsSection, requirementItemSchema, requirementItemToObj } from "@/components/ui/requirementsSection";

const RESERVATION_CUTOFF_MS = 2 * 60 * 60 * 1000;
const EMPTY_SLOTS = Object.freeze([]);

function getReservationPrefill(searchParams, todayRange) {
  const startParam = searchParams.get("start");
  const parsedStart = startParam ? new Date(startParam) : null;
  const requestedStart = parsedStart && Number.isFinite(parsedStart.getTime())
    ? parsedStart
    : null;
  
  const requestedPartySize = Number(searchParams.get("partySize"));
  const partySize = Number.isInteger(requestedPartySize) && requestedPartySize >= 1
    ? requestedPartySize
    : 1;
  const requestedTimeSlotIdValue = Number(searchParams.get("timeSlotId"));
  const requestedTimeSlotId = Number.isInteger(requestedTimeSlotIdValue) && requestedTimeSlotIdValue >= 1
    ? requestedTimeSlotIdValue
    : null;
  const localDate = requestedStart ? getLocalDateValue(requestedStart) : getLocalDateValue();

  return {
    requestedTimeSlotId,
    formValues: {
      date: localDate,
      timeSlotId: "",
      partySize,
      dietaryRequirements: [],
    },
  };
}

function isBookable(slot) {
  return Number(slot.freeSeats) > 0
    && new Date(slot.startDateTime).getTime() - Date.now() >= RESERVATION_CUTOFF_MS;
}

function getPartySizeErrors(items, partySize) {
  if (!(partySize >= 1)) return [];

  const totalPeople = (allergies) => (items ?? [])
    .filter((item) => item.allergies === allergies)
    .reduce((sum, item) => sum + (Number.isInteger(item.people) ? item.people : 0), 0);

  const allergicPeople = totalPeople(true);
  const otherPeople = totalPeople(false);

  return [
    allergicPeople > partySize && `The number of people with allergies exceeds the party size`,
    otherPeople > partySize && `The number of people with dietary requirements exceeds the party size`,
  ].filter(Boolean);
}

function PageCreateReservation() {
  const [availability, setAvailability] = useState({ rangeKey: null, slots: [], error: false });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { requestedTimeSlotId, formValues: formInitialValues } = getReservationPrefill(searchParams);

  const formSchema = zod.object({
    date: zod.string().min(1, "Date is required"),
    timeSlotId: zod.string().min(1, "Choose an available time slot").transform(Number),
    partySize: zod.coerce.number().int().min(1, "Enter at least 1 person"),
    dietaryRequirements: zod.array(requirementItemSchema),
  }).superRefine((values, context) => {

    values.dietaryRequirements.forEach((item, index) => {
      if (!Number.isInteger(item.people) || item.people < 1) {
        context.addIssue({
          code: "custom",
          path: ["dietaryRequirements", index, "people"],
          message: "Enter at least 1 person",
        });
      }

      if (!item.description.trim()) {
        context.addIssue({
          code: "custom",
          path: ["dietaryRequirements", index, "description"],
          message: "This field is required",
        });
      }
    });

    getPartySizeErrors(values.dietaryRequirements, values.partySize).forEach((message) => {
      context.addIssue({
        code: "custom",
        path: ["dietaryRequirements"],
        message,
      });
    });

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
    defaultValues: formInitialValues,
  });

  const { handleSubmit, setValue, trigger, control, formState } = form;
  const date = useWatch({ control, name: "date" });
  const timeSlotId = useWatch({ control, name: "timeSlotId" });
  const partySize = Number(useWatch({ control, name: "partySize" }));
  const dietaryRequirements = useWatch({ control, name: "dietaryRequirements" });
  const dateKey = date;
  const dateIsValid = date && !Number.isNaN(new Date(date).getTime());
  const dayAvailability = availability.rangeKey === dateKey ? availability : null;
  const slots = dayAvailability?.slots ?? EMPTY_SLOTS;
  const availabilityError = dayAvailability?.error ?? false;
  const isLoading = dateIsValid && (loading || !dayAvailability);
  const selectedSlot = slots.find((slot) => slot.timeSlotId === Number(timeSlotId));
  const bookableSlots = slots.filter(isBookable);
  const onlyOne = bookableSlots.length == 1 ? true : false;

  const fetchAvailability = useCallback(async (selectedDate, isCurrent = () => true) => {
    setLoading(true);

    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    try {
      const response = await api.timeslots.getAll({
        from: startOfDay.toISOString(),
        to: endOfDay.toISOString(),
      });

      if (!isCurrent()) return response;

      if (response?.success && Array.isArray(response.data)) {
        setAvailability({ rangeKey: selectedDate, slots: response.data, error: false });
      } else {
        setAvailability({ rangeKey: selectedDate, slots: [], error: true });
      }

      return response;
    } catch {
      if (isCurrent()) setAvailability({ rangeKey: selectedDate, slots: [], error: true });
      return null;
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setValue("timeSlotId", "");
    setValue("partySize", formInitialValues.partySize);

    if (dateIsValid) {
      let active = true;
      Promise.resolve().then(() => {
        if (active) return fetchAvailability(date, () => active);
      }).catch((e) => { console.error("Failed to fetch availability: ", e) });

      return () => {
        active = false;
      };
    }
  }, [fetchAvailability, formInitialValues.partySize, date, dateIsValid, setValue]);

  useEffect(() => {
    if (loading || !requestedTimeSlotId || timeSlotId) return;

    const requestedSlot = slots.find((slot) => slot.timeSlotId === requestedTimeSlotId);

    if (requestedSlot) {
      setValue("timeSlotId", String(requestedSlot.timeSlotId), { shouldValidate: true });
    }
  }, [loading, requestedTimeSlotId, setValue, slots, timeSlotId]);

  useEffect(() => {
    if (timeSlotId && !loading) trigger(["timeSlotId", "partySize"]);
  }, [loading, slots, timeSlotId, trigger]);

  function handleSelectSlot(slot, field) {
    field.onChange(String(slot.timeSlotId));
    trigger("partySize");
  }

  async function handleReservation(data) {
    const response = await api.reservations.create({
      timeSlotId: data.timeSlotId,
      partySize: data.partySize,
      dietaryRequirements: data.dietaryRequirements.map((item) => requirementItemToObj(item)),
    });

    if (response?.success) {
      toast.success("Reservation confirmed!");
      //setValue("timeSlotId", "");
      //setValue("partySize", 1);
      navigate("/", { viewTransition: true });
      return;
    }

    await fetchAvailability(date);
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
                  name="date"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="reservation-date">Date</FieldLabel>
                      <Input
                        {...field}
                        id="reservation-from"
                        type="date"
                        step="1"
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
                        <FieldLabel>Available slots</FieldLabel>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {isLoading ? "Checking availability…" : `${bookableSlots.length} open ${bookableSlots.length === 1 ? "slot" : "slots"}`}
                        </p>
                      </div>
                      <Clock3 aria-hidden="true" className="mb-1 size-5 text-muted-foreground" />
                    </div>

                    {!dateIsValid ? (
                      <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                        Choose a valid date to see available slots.
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
                        No bookable slots in this range. Try another date.
                      </p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {bookableSlots.map((slot) => {
                          const isSelected = Number(field.value) === slot.timeSlotId;

                          return (
                            <Button
                              key={slot.timeSlotId}
                              type="button"
                              variant={onlyOne ? "default" : isSelected ? "default" : "outline"}
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
                        disabled={(!onlyOne && !selectedSlot) || formState.isSubmitting}
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

              <RequirementsSection
                control={control}
                errors={getPartySizeErrors(dietaryRequirements, partySize)}
                addDisabled={!onlyOne && !selectedSlot}
                disabled={formState.isSubmitting}
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

export default PageCreateReservation;
