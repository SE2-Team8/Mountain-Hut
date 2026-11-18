import api from "@/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useNavigate, useParams, Link } from "react-router";

import * as zod from 'zod';
import { zodResolver } from "@hookform/resolvers/zod";
import "../assets/css/auth.css"
import { useEffect, useState } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { dateAndTimeStringsToDate, formatDateTime } from "@/utils/date";
import { RequirementsSection, requirementItemSchema, requirementObjToItem } from "@/components/ui/requirementsSection";

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

function PageInspectReservation() {
	
	const navigate = useNavigate();
	const { reservation_id } = useParams();

	// if no reservation id is set, go to error page
	if (!reservation_id) {
		console.log("No reservation id is set -> error page");
		navigate("/errorNoIdSet");
	}

	// reservation data
	const [reservation, setReservation] = useState(null);
	const [reservationLoaded, setReservationLoaded] = useState(false);
	const [availableTimeslots, setAvailableTimeSlots] = useState(null);

	const form = useForm({
		resolver: zodResolver(formSchema),
		mode: "onChange",
		reValidateMode: "onChange",
		defaultValues: {
		date: todayISO(),
		partySize: 1,
		timeSlotId: 0,
		},
	});

  	const { control, handleSubmit, setValue, getValues, formState } = form;
  	const selectedDate = useWatch({ control, name: "date" });
	const partySize = Number(useWatch({ control, name: "partySize" }) ?? 0);
	const dietaryRequirements = useWatch({ control, name: "dietaryRequirements" });

	// When the date changes, clear the previously chosen time so the user
	// can't keep a stale time from another day.
	useEffect(() => {
		setValue("time", "", { shouldValidate: false });
	}, [selectedDate, setValue]);

	// When the date changes, fetch the timeslots for that date
	useEffect(() => {
		const getAvailableTimeslots = async () => {
			// try {
				if (!selectedDate)
					return;
				const dateStr = selectedDate;
				console.log("Fetching all timeslots on date ", dateStr);
				const response = await api.timeslots.getAll({
					from: dateAndTimeStringsToDate(dateStr, "00:01").toISOString(),
        			to: dateAndTimeStringsToDate(dateStr, "23:59").toISOString(),
				});

				if (response?.success && Array.isArray(response.data)) {
					setAvailableTimeSlots(response.data);
					console.log(response.data);
				} else {
					// maybe something?
				}
				
			// } catch(err) {
			// 	console.log(err);
			// 	navigate("/error");
			// }
		}

		// TODO: maybe have a guard to invoke less API calls
		// if there is no reservation, fetch it
		if (selectedDate >= todayISO())
			getAvailableTimeslots();
		
	}, [selectedDate]);

	// update the reservation by fetching it from the server from its id whenever it changes
	useEffect(() => {
		const getReservation = async () => {
			// try {
				const reserv = await api.reservations.get(reservation_id);
				setReservation(reserv);
				setReservationLoaded(true);
			// } catch(err) {
			// 	navigate("/error");
			// }
		}

		// if there is no reservation, fetch it
		if (!reservation)
			getReservation();
		
	}, [reservation]);


	// set form data when reservation changes
	useEffect(() => {
		if (!reservation) return;
		form.reset({
			date: toDateInputValue(new Date(reservation.startDateTime)),
			partySize: reservation.partySize,
			timeSlotId: reservation.timeSlotId,
			dietaryRequirements: (reservation.dietaryRequirements ?? []).map((reqObj) => requirementObjToItem(reqObj)),
		});
	}, [reservation, form]);

	function handleSelectSlot(slot, field) {
		field.onChange(Number(slot.timeSlotId));
		// trigger("partySize");
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

		function handleEditCancel() {
		// TODO: back to non-form view
	}

	async function handleEditSubmit(values) {
		toast.success(`Submit called with ${JSON.stringify(values)}`);
	}


	return (
		<Card className="border-white/70 bg-card/95 shadow-xl shadow-black/5 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Reservation details</CardTitle>
          <CardDescription>
            Edit your reservation
          </CardDescription>
        </CardHeader>
        <CardContent>
			{ !reservationLoaded ? (
				<p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground" role="status">
				Loading reservation data...
				</p>
			) :
			(<>
				{/* FORM */}
				<form onSubmit={handleSubmit(handleEditSubmit)}>
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
							min={tomorrowISO()}          // UI hint
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

					{/* ITEM SELECTION */}
					<Controller
					name="timeSlotId"
					control={control}
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid}>
							<div className="flex items-end justify-between gap-3">
								<div>
								<FieldLabel>Available times</FieldLabel>
								{/* <p className="mt-1 text-sm text-muted-foreground">
									{isLoading ? "Checking availability…" : `${bookableSlots.length} open ${bookableSlots.length === 1 ? "slot" : "slots"}`}
								</p> */}
								</div>
								{/* <Clock3 aria-hidden="true" className="mb-1 size-5 text-muted-foreground" /> */}
							</div>

							{ availableTimeslots == null ? (
								<p>Not loaded</p>
							) :
							
							// !rangeIsValid ? (
							// 	<p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
							// 	Choose a valid date and time range to see available slots.
							// 	</p>
							// ) : 
							//  availabilityError ? (
							// 	<p className="rounded-xl border border-dashed p-5 text-center text-sm text-destructive" role="alert">
							// 	Availability could not be loaded. Please adjust the range or try again.
							// 	</p>
							// ) : 
							availableTimeslots.length === 0 ? (
								<p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
								No bookable slots in this date. Try another date.
								</p>
							) : 
							( 
								<div className="grid gap-2 sm:grid-cols-2">
								{availableTimeslots.map((slot) => {
									const canBeSelected = partySize >= 1 && partySize <= Number(slot.freeSeats);
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

							<RequirementsSection
								control={control}
								errors={getPartySizeErrors(dietaryRequirements, partySize)}
								// addDisabled={!selectedSlot}
								disabled={formState.isSubmitting}
							/>

							{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</Field>
					)}
					/>

					{/* BUTTONS */}
					<div className="flex flex-col gap-2 sm:flex-row">
					<Button
						type="button"
						variant="outline"
						className="flex-1"
						onClick={handleEditCancel}
						disabled={formState.isSubmitting}
					>
						Cancel (discard modifications)
					</Button>
					<Button
						type="submit"
						className="flex-1"
						disabled={formState.isSubmitting}
					>
						{formState.isSubmitting ? "Submitting…" : "Confirm modifications"}
					</Button>
					</div>
				</FieldGroup>
				</form>
				</>
			)
			}
			</CardContent>
			{ reservationLoaded ?
				<pre className="overflow-auto rounded-md bg-muted p-4 text-sm">
					{JSON.stringify(reservation, null, 2)}
				</pre>
				: 
				<pre className="overflow-auto rounded-md bg-muted p-4 text-sm">No reservation loaded</pre>
			}
	</Card>
  );
}

export default PageInspectReservation;