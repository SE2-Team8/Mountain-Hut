import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { Controller, useForm } from "react-hook-form";
import * as zod from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import api from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, MandatoryLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import useUserStore from "@/store/user";

const STAFF_ROLES = new Set(["EMPLOYEE", "WARDEN"]);

// same fields and rules as the sign up page, without the password:
// the hiker chooses it with the setup link sent by email
const formSchema = zod.object({
	email: zod.email("Invalid email"),
	fullName: zod.string().trim().min(1, "Full name is required"),
	phone: zod
		.string()
		.min(1, "Phone number is required")
		.refine((v) => isValidPhoneNumber(v), "Invalid phone number"),
	emergencyPhone: zod
		.string()
		.optional()
		.refine((v) => !v || isValidPhoneNumber(v), "Invalid phone number"),
	notes: zod.string().optional(),
});

const EMPTY_FORM = { email: "", fullName: "", phone: "", emergencyPhone: "", notes: "" };

// a full hiker account created by an employee: the hiker can then use the website
function PageCreateHiker() {
	const user = useUserStore((state) => state.user);
	const navigate = useNavigate();
	// the hiker just created: the page then shows the confirmation instead of the form
	const [createdHiker, setCreatedHiker] = useState(null);

	const form = useForm({
		resolver: zodResolver(formSchema),
		mode: "onChange",
		reValidateMode: "onChange",
		defaultValues: EMPTY_FORM,
	});

	if (!user) return <Navigate to="/auth/login" replace />;
	if (!STAFF_ROLES.has(user.role)) return <Navigate to="/" replace />;

	async function handleCreate(data) {
		const response = await api.users.create({
			email: data.email.trim(),
			fullName: data.fullName.trim(),
			phone: data.phone,
			...(data.notes?.trim() && { notes: data.notes.trim() }),
			...(data.emergencyPhone?.trim() && { emergencyContact: data.emergencyPhone.trim() }),
		});

		if (response?.success) {
			setCreatedHiker(response.data);
			toast.success("Hiker account created");
			return;
		}

		if (response?.response?.status === 409)
			form.setError("email", { type: "server", message: "Another user with this email is already registered" });
	}

	function handleCreateAnother() {
		form.reset(EMPTY_FORM);
		setCreatedHiker(null);
	}

	if (createdHiker) {
		return (
			<section className="mx-auto max-w-2xl py-8">
				<Card className="border-white/70 bg-card/95 shadow-xl shadow-black/5 backdrop-blur-sm">
					<CardHeader>
						<div className="mb-1 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<MailCheck aria-hidden="true" className="size-5" />
						</div>
						<CardTitle>Account created for {createdHiker.fullName}</CardTitle>
						<CardDescription>
							We sent an email to <strong>{createdHiker.email}</strong> with a link to set the password.
							The link is valid for 24 hours: after that, the hiker can use “Forgot password” on the login page.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-2 sm:flex-row">
						<Button
							className="flex-1"
							onClick={() => navigate("/reservations/book-for-hiker", { state: { hiker: createdHiker }, viewTransition: true })}
						>
							Book for this hiker
						</Button>
						<Button className="flex-1" variant="outline" onClick={handleCreateAnother}>
							Create another account
						</Button>
					</CardContent>
				</Card>
			</section>
		);
	}

	return (
		<section className="mx-auto max-w-2xl py-8">
			<Card className="border-white/70 bg-card/95 shadow-xl shadow-black/5 backdrop-blur-sm">
				<CardHeader>
					<CardTitle>New hiker account</CardTitle>
					<CardDescription>
						Create an account for a hiker who books by phone or at the hut. They will receive an email to choose their password and can then use the website.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={form.handleSubmit(handleCreate)} noValidate>
						<fieldset disabled={form.formState.isSubmitting} className="contents">
							<FieldGroup>
								<Controller
									name="email"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field data-invalid={fieldState.invalid}>
											<MandatoryLabel htmlFor="email">Email</MandatoryLabel>
											<Input {...field} id="email" type="email" autoComplete="off" placeholder="hiker@example.com" aria-invalid={fieldState.invalid} />
											<FieldDescription>The link to set the password is sent to this address.</FieldDescription>
											{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
										</Field>
									)}
								/>

								<Controller
									name="fullName"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field data-invalid={fieldState.invalid}>
											<MandatoryLabel htmlFor="fullName">Full name</MandatoryLabel>
											<Input {...field} id="fullName" autoComplete="off" placeholder="John Doe" aria-invalid={fieldState.invalid} />
											{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
										</Field>
									)}
								/>

								<div className="grid gap-4 sm:grid-cols-2">
									<Controller
										name="phone"
										control={form.control}
										render={({ field, fieldState }) => (
											<Field data-invalid={fieldState.invalid}>
												<MandatoryLabel htmlFor="phone">Phone number</MandatoryLabel>
												<PhoneInput
													{...field}
													id="phone"
													international
													defaultCountry="IT"
													onChange={(value) => field.onChange(value ?? "")}
													aria-invalid={fieldState.invalid}
												/>
												{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
											</Field>
										)}
									/>

									<Controller
										name="emergencyPhone"
										control={form.control}
										render={({ field, fieldState }) => (
											<Field data-invalid={fieldState.invalid}>
												<FieldLabel htmlFor="emergencyPhone">Emergency phone number</FieldLabel>
												<PhoneInput
													{...field}
													id="emergencyPhone"
													international
													defaultCountry="IT"
													onChange={(value) => field.onChange(value ?? "")}
													aria-invalid={fieldState.invalid}
												/>
												{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
											</Field>
										)}
									/>
								</div>

								<Controller
									name="notes"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field data-invalid={fieldState.invalid}>
											<FieldLabel htmlFor="notes">Notes</FieldLabel>
											<Textarea {...field} id="notes" aria-invalid={fieldState.invalid} />
											{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
										</Field>
									)}
								/>

								<div className="flex flex-col gap-2 sm:flex-row">
									<Button type="button" variant="outline" className="flex-1" asChild>
										<Link to="/reservations/book-for-hiker" viewTransition>Cancel</Link>
									</Button>
									<Button type="submit" className="flex-1">
										{form.formState.isSubmitting ? "Creating…" : "Create account"}
									</Button>
								</div>
							</FieldGroup>
						</fieldset>
					</form>
				</CardContent>
			</Card>
		</section>
	);
}

export default PageCreateHiker;