import api from "@/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useNavigate, useParams } from "react-router";

import * as zod from 'zod';
import { zodResolver } from "@hookform/resolvers/zod";
import "../assets/css/auth.css"
import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { dateAndTimeStringsToDate, formatDateTime } from "@/utils/date";
import { RequirementsSection, requirementItemSchema, requirementObjToItem, requirementItemToObj } from "@/components/ui/requirementsSection";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// --- helpers -------------------------------------------------------------

function toDateInputValue(d) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return toDateInputValue(d);
}

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return toDateInputValue(d);
}

// --- schema --------------------------------------------------------------

const formSchema = zod.object({
  // must be strictly after today → min = tomorrow
  date: zod
    .string()
    .min(1, "Reservation date is required")
    .refine((v) => v >= todayISO(), "Date must be at least today"),
  partySize: zod.coerce
    .number({ invalid_type_error: "Party size is the number of people in the party" })
    .int("Must be a whole number")
    .min(1, "At least 1 person per party"),
  timeSlotId: zod.number().min(1, "Choose a time slot"),
  dietaryRequirements: zod.array(requirementItemSchema),
});

// --- form component ------------------------------------------------------

function ReservationEditForm({ reservation, onCancel, onSuccess }) {
  const form = useForm({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      date: toDateInputValue(new Date(reservation.startDateTime)),
      partySize: reservation.partySize,
      timeSlotId: reservation.timeSlotId,
      dietaryRequirements: (reservation.dietaryRequirements ?? []).map((reqObj) => requirementObjToItem(reqObj)),
    },
  });

  const { control, handleSubmit, setValue, formState } = form;
  const selectedDate = useWatch({ control, name: "date" });
  const partySize = Number(useWatch({ control, name: "partySize" }) ?? 0);
  const dietaryRequirements = useWatch({ control, name: "dietaryRequirements" });

  const [availableTimeslots, setAvailableTimeSlots] = useState(null);


  useEffect(() => {
  if (!availableTimeslots) return;
  const current = form.getValues("timeSlotId");
  const stillValid = availableTimeslots.some(
    (s) => Number(s.timeSlotId) === Number(current)
  );
  if (!stillValid) setValue("timeSlotId", 0, { shouldValidate: false });
}, [availableTimeslots, setValue, form]);

  // When the date changes, fetch the timeslots for that date
  useEffect(() => {
    const getAvailableTimeslots = async () => {
      if (!selectedDate) return;
      const dateStr = selectedDate;
      const response = await api.timeslots.getAll({
        from: dateAndTimeStringsToDate(dateStr, "00:01").toISOString(),
        to: dateAndTimeStringsToDate(dateStr, "23:59").toISOString(),
      });

      if (response?.success && Array.isArray(response.data)) {
        setAvailableTimeSlots(response.data);
      }
    };

    if (selectedDate >= todayISO()) getAvailableTimeslots();
  }, [selectedDate]);

  function handleSelectSlot(slot, field) {
    field.onChange(Number(slot.timeSlotId));
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

  async function handleEditSubmit(values) {
	if (formState.isSubmitting) return;

	const newReservation = {
		timeSlotId: values.timeSlotId,
		partySize: values.partySize,
		dietaryRequirements: values.dietaryRequirements.map((req) => requirementItemToObj(req)),
	}

	const response = await api.reservations.update(reservation.reservId, newReservation);
	
	if (!response.success) {
		// TODO: handle error when update goes wrong?
	}
    // toast.success(`Submit called with ${JSON.stringify(values)}`);
    // toast.success(`Reservation obj: ${JSON.stringify(newReservation)}`);
	onSuccess?.();
  }

  const [confirmOpen, setConfirmOpen] = useState(false);

	async function handleConfirmClick() {
	const valid = await form.trigger(); // validates every field, returns boolean
	if (valid) setConfirmOpen(true);
	}

  return (
    <form onSubmit={async (e) => {
		e.preventDefault();
			const valid = await form.trigger();
			if (valid) setConfirmOpen(true);
		}}>
      <FieldGroup>
        {/* DATE */}
        <Controller
          name="date"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="date">Date</FieldLabel>
              <Input
                {...field}
                id="date"
                type="date"
                min={tomorrowISO()}
                disabled={formState.isSubmitting}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* PARTY SIZE */}
        <Controller
          name="partySize"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="partySize">Party size</FieldLabel>
              <Input
                {...field}
                id="partySize"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={field.value ?? ""}
                onChange={(e) =>
                  field.onChange(e.target.value === "" ? "" : Number(e.target.value))
                }
                disabled={formState.isSubmitting}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* TIMESLOT SELECTION */}
        <Controller
          name="timeSlotId"
          control={control}
          render={({ field, fieldState }) => (
            <Field>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <FieldLabel>Available slots</FieldLabel>
                </div>
              </div>

              {availableTimeslots == null ? (
                <p>Not loaded</p>
              ) : availableTimeslots.length === 0 ? (
                <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                  No bookable slots in this date. Try another date.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {availableTimeslots.map((slot) => {
					const isOriginalSlot = slot.timeSlotId == reservation.timeSlotId;
					const toRemoveSeats = isOriginalSlot? reservation.partySize : 0;
                    const canBeSelected = partySize <= Number(slot.freeSeats) + toRemoveSeats;
                    const isSelected = Number(field.value) === slot.timeSlotId;
                    return (
                      <Button
                        key={slot.timeSlotId}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        className="h-auto min-h-16 justify-between gap-3 whitespace-normal rounded-xl px-4 py-3 text-left"
                        aria-pressed={isSelected}
                        disabled={formState.isSubmitting || !canBeSelected}
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

		{/* DIETARY REQUIREMENTS */}
		<RequirementsSection
			control={control}
			errors={getPartySizeErrors(dietaryRequirements, partySize)}
			disabled={formState.isSubmitting}
		/>

        {/* BUTTONS */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <AlertDialog>
			<AlertDialogTrigger asChild>
				<Button
				type="button"
				variant="outline"
				className="flex-1"
				disabled={formState.isSubmitting}
				>
				Discard changes
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
				<AlertDialogTitle>Discard modifications?</AlertDialogTitle>
				<AlertDialogDescription>
					Any unsaved changes to this reservation will be lost. This can't be undone.
				</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
				<AlertDialogCancel>Keep editing</AlertDialogCancel>
				<AlertDialogAction
					onClick={onCancel}
					className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
				>
					Discard changes
				</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
			</AlertDialog>
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
			<Button
				type="button"
				className="flex-1"
				disabled={formState.isSubmitting}
				onClick={handleConfirmClick}
			>
				{formState.isSubmitting ? "Submitting…" : "Confirm changes"}
			</Button>
			<AlertDialogContent>
				<AlertDialogHeader>
				<AlertDialogTitle>Save modifications?</AlertDialogTitle>
				<AlertDialogDescription>
					Your changes to this reservation will be saved.
				</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
				<AlertDialogCancel>Keep editing</AlertDialogCancel>
				<AlertDialogAction
					disabled={formState.isSubmitting}
					onClick={handleSubmit(handleEditSubmit)}
				>
					{formState.isSubmitting ? "Saving…" : "Save changes"}
				</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
			</AlertDialog>
        </div>
      </FieldGroup>
    </form>
  );
}

// --- view reservation component ------------------------------------------------------

function ReservationReadView({ reservation, onEdit }) {
  const requirements = reservation.dietaryRequirements ?? [];

  const valueClass = "font-medium text-muted-foreground";
  const labelClass = "text-sm text-foreground";

  return (
    <div className="space-y-4">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className={labelClass}>Date</dt>
          <dd className={valueClass}>
            {toDateInputValue(new Date(reservation.startDateTime))}
          </dd>
        </div>
        <div>
          <dt className={labelClass}>Party size</dt>
          <dd className={valueClass}>{reservation.partySize}</dd>
        </div>
        <div>
          <dt className={labelClass}>Start time</dt>
          <dd className={valueClass}>{reservation.startDateTime.slice(11, 16)}</dd>
        </div>
		<div>
          <dt className={labelClass}>End time</dt>
          <dd className={valueClass}>{reservation.endDateTime.slice(11, 16)}</dd>
        </div>
        <div className="sm:col-span-2">
		<dt className={labelClass}>Dietary requirements</dt>
		<dd className={valueClass}>
			{requirements.length === 0 ? (
			"None"
			) : (
			<ul className="mt-1 space-y-1">
				{requirements.map((req, i) => (
				<li key={i} className="flex items-start gap-2">
					<span className={"mt-1 size-2 shrink-0 rounded-full bg-muted-foreground/40"}
					aria-hidden="true"
					/>
					<span>
					{req.description}
					{req.allergies && (
						<span className="ml-2 text-xs font-medium">(allergy)</span>
					)}
					</span>
				</li>
				))}
			</ul>
			)}
		</dd>
		</div>
      </dl>

      <div className="flex justify-center pt-2">
		<Button type="button" onClick={onEdit} className="gap-2">
			<Pencil className="size-4" aria-hidden="true" />
			Edit reservation
		</Button>
	  </div>
    </div>
  );
}

// --- page component ------------------------------------------------------

const ReservationMode = {
  VIEW: "VIEW",
  EDIT: "EDIT",
};

function PageInspectReservation() {
  const navigate = useNavigate();
  const { reservation_id } = useParams();

  // if no reservation id is set, go to error page
  if (!reservation_id) {
    navigate("/errorNoIdSet");
  }

  // reservation data
  const [reservation, setReservation] = useState(null);
  const [reservationLoaded, setReservationLoaded] = useState(false);
  const [mode, setMode] = useState(ReservationMode.VIEW);

  // update the reservation by fetching it from the server from its id whenever it changes
  const fetchReservation = useCallback(async () => {
	const response = await api.reservations.get(reservation_id);
	if (response.success) {
		setReservation(response.data);
		setReservationLoaded(true);
	}
	else {
		// TODO: handle error when fetching non existent-reservation?
	}
	
	}, [reservation_id]);

	useEffect(() => {
	fetchReservation();
  }, [fetchReservation]);

  function handleEditCancel() {
	setMode(ReservationMode.VIEW);
  }

  async function handleEditSuccess() {
	setReservationLoaded(false);
	setMode(ReservationMode.VIEW);
	await fetchReservation();
  }

  return (
   <Card className="mx-auto mt-12 w-full max-w-4xl border-white/70 bg-card/95 shadow-xl shadow-black/5 backdrop-blur-sm">
      
        {reservationLoaded ?
			(<CardHeader>
				<CardTitle>
				{ mode === ReservationMode.EDIT ? "Edit your reservation" : "Reservation details" }
				</CardTitle>
			</CardHeader>) : (
				<></>
			)
		}
      <CardContent>
		{!reservationLoaded ? (
			<p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground" role="status">
			Loading reservation data...
			</p>
		) : mode === ReservationMode.EDIT ? (
			<ReservationEditForm
			reservation={reservation}
			onCancel={handleEditCancel}
			onSuccess={handleEditSuccess}
			/>
		) : (
			<ReservationReadView
			reservation={reservation}
			onEdit={() => setMode(ReservationMode.EDIT)}
			/>
		)}
		</CardContent>
    </Card>
  );
}

export default PageInspectReservation;