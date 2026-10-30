import { useEffect, useState } from "react";
import api from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import * as zod from 'zod';
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

const CUTOFF_MS = 2 * 60 * 60 * 1000;  // reservation possible up to 2 hours before

const todayISO = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
};

const isTooLate = (date, time) =>
    new Date(`${date}T${time}`).getTime() - Date.now() < CUTOFF_MS;

function PageReservations() {
  const [slots, setSlots] = useState([]); // [{ time, availableSeats }]
  const [loading, setLoading] = useState(false);

  const formSchema = zod.object({
    date: zod.string().nonempty("Date is required"),
    time: zod.string().nonempty("Time is required"),
    people: zod.number("Number of people is required").int().min(1, "At least 1 person")
  }).superRefine((values, ctx) => {
    const slot = slots.find((s) => s.time === values.time);
    if (slot && values.people > slot.availableSeats) {
      ctx.addIssue({
        code: "custom",
        path: ["people"],
        message: `Only ${slot.availableSeats} seats available`
      });
    }
    if (values.date && values.time && isTooLate(values.date, values.time)) {
      ctx.addIssue({
        code: "custom",
        path: ["time"],
        message: "You can book up to 2 hours before the chosen time"
      });
    }
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: todayISO(),
      time: '',
      people: 1
    }
  });

  const date = form.watch("date");
  const time = form.watch("time");
  const selectedSlot = slots.find((s) => s.time === time);
  const maxPeople = selectedSlot?.availableSeats;

  async function loadSlots(d) {
    setLoading(true);
    const response = await api.reservations.getAvailability(d);
    setSlots(response?.success ? response.data ?? [] : []);
    setLoading(false);
  }

  // when changing date, the selected slot could be not available anymore
  useEffect(() => {
    form.setValue("time", "");
    setSlots([]);
    if (date) loadSlots(date);
  }, [date]);

  function handleSelectSlot(slot, field) {
    field.onChange(slot.time);
    // keep the party size within the seats of the selected slot
    const people = form.getValues("people");
    form.setValue("people", Math.min(Math.max(Number(people) || 1, 1), slot.availableSeats));
  }

  const handlePeopleChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (Number.isNaN(value)) return setPeople("");
    setPeople(Math.min(Math.max(value, 1), maxPeople || 1));
  };

  async function handleReservation(data) {
    const response = await api.reservations.create(data);
    if (response?.success) {
      toast.success("Reservation confirmed!");
      form.reset({ date: data.date, time: '', people: 1 });
    }
    // on error the toast is already shown by httpClient;
    // in both cases availability may have changed
    loadSlots(data.date);
  }

  return (
    <Card className="max-w-xl mx-auto">
      <CardHeader>
        <CardTitle>Book a table</CardTitle>
        <CardDescription>
          Tables are shared. You can book up to 2 hours before the chosen time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleReservation)}>
          <FieldGroup>

            <Controller
              name='date'
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>

                  <FieldLabel htmlFor='date'>Date</FieldLabel>
                  <Input
                    {...field}
                    id='date'
                    type='date'
                    min={todayISO()}
                    aria-invalid={fieldState.invalid} />
                  {
                    fieldState.invalid
                    &&
                    <FieldError errors={[fieldState.error]} />
                  }

                </Field>
              )} />

            <Controller
              name='time'
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>

                  <FieldLabel>Time</FieldLabel>
                  {
                    loading ? (
                      <p className="text-sm text-muted-foreground animate-pulse">Loading availability...</p>
                    ) : slots.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No time slots for this date.</p>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {slots.map((slot) => (
                          <Button
                            key={slot.time}
                            type="button"
                            variant={field.value === slot.time ? "default" : "outline"}
                            disabled={slot.availableSeats < 1 || isTooLate(date, slot.time)}
                            onClick={() => handleSelectSlot(slot, field)}
                          >
                            {slot.time}
                          </Button>
                        ))}
                      </div>
                    )
                  }
                  {
                    fieldState.invalid
                    &&
                    <FieldError errors={[fieldState.error]} />
                  }

                </Field>
              )} />

            <Controller
              name='people'
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>

                  <FieldLabel htmlFor='people'>Number of people</FieldLabel>
                  <Input
                    {...field}
                    id='people'
                    type='number'
                    min={1}
                    max={maxPeople}
                    disabled={!selectedSlot}
                    onChange={(e) => {
                      const value = e.target.value === "" ? "" : Number(e.target.value);
                      field.onChange(value === "" ? value : Math.min(value, maxPeople ?? value));
                    }}
                    aria-invalid={fieldState.invalid} />
                  <p className="text-sm text-muted-foreground">
                    {selectedSlot
                      ? `${maxPeople} seats available at ${time}`
                      : "Select a time first"}
                  </p>
                  {
                    fieldState.invalid
                    &&
                    <FieldError errors={[fieldState.error]} />
                  }

                </Field>
              )} />

            <Field>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Booking..." : "Confirm reservation"}
              </Button>
            </Field>

          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

export default PageReservations;