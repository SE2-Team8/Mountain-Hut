import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Check, Search, UserRound, UserRoundPlus } from "lucide-react";
import api from "@/api";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel, MandatoryLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { HikerMode, emptyHikerSelection, emptyTemporaryHiker } from "@/utils/hikerSelection";

// the search starts from the first character, after a short pause in typing
const MIN_SEARCH_LENGTH = 1;
const SEARCH_DELAY_MS = 300;

function HikerPicker({ value, onChange, error, disabled = false, createHikerHref }) {
	const selection = value ?? emptyHikerSelection();

	function switchMode(mode) {
		if (mode === selection.mode) return;
		onChange(mode === HikerMode.TEMPORARY ? emptyTemporaryHiker() : emptyHikerSelection());
	}

	return (
		<Field>
			<FieldLabel>Who is the reservation for?</FieldLabel>

			<div className="grid grid-cols-2 gap-2" role="group" aria-label="Kind of hiker">
				<Button
					type="button"
					variant={selection.mode === HikerMode.REGISTERED ? "default" : "outline"}
					aria-pressed={selection.mode === HikerMode.REGISTERED}
					disabled={disabled}
					onClick={() => switchMode(HikerMode.REGISTERED)}
				>
					<UserRound aria-hidden="true" />
					Registered hiker
				</Button>
				<Button
					type="button"
					variant={selection.mode === HikerMode.TEMPORARY ? "default" : "outline"}
					aria-pressed={selection.mode === HikerMode.TEMPORARY}
					disabled={disabled}
					onClick={() => switchMode(HikerMode.TEMPORARY)}
				>
					<UserRoundPlus aria-hidden="true" />
					Temporary hiker
				</Button>
			</div>

			{selection.mode === HikerMode.REGISTERED ? (
				selection.user ? (
					<SelectedHiker
						user={selection.user}
						disabled={disabled}
						onChangeHiker={() => onChange(emptyHikerSelection())}
					/>
				) : (
					<HikerSearch
						disabled={disabled}
						createHikerHref={createHikerHref}
						onSelect={(user) => onChange({ mode: HikerMode.REGISTERED, user })}
						onUseTemporary={() => switchMode(HikerMode.TEMPORARY)}
					/>
				)
			) : (
				<TemporaryHikerFields value={selection} onChange={onChange} disabled={disabled} />
			)}

			{error && <FieldError errors={[{ message: error }]} />}
		</Field>
	);
}

function HikerSearch({ onSelect, onUseTemporary, disabled, createHikerHref }) {
	const [query, setQuery] = useState("");
	// the last answer of the server, with the text it answers to
	const [result, setResult] = useState({ query: "", hikers: [], failed: false });

	const searched = query.trim();
	const tooShort = searched.length < MIN_SEARCH_LENGTH;
	const loading = !tooShort && result.query !== searched;

	useEffect(() => {
		if (tooShort) return;

		let active = true;
		const timer = setTimeout(async () => {
			const response = await api.users.search(searched);
			// a slower answer for an older text must not replace the current one
			if (!active) return;

			const ok = response?.success && Array.isArray(response.data);
			setResult({ query: searched, hikers: ok ? response.data : [], failed: !ok });
		}, SEARCH_DELAY_MS);

		return () => {
			active = false;
			clearTimeout(timer);
		};
	}, [searched, tooShort]);

	return (
		<div className="space-y-3">
			<div className="relative">
				<Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					id="hiker-search"
					type="search"
					value={query}
					placeholder="Name, email or phone number"
					aria-label="Search a registered hiker"
					autoComplete="off"
					className="pl-10"
					disabled={disabled}
					onChange={(event) => setQuery(event.target.value)}
				/>
			</div>

			<div aria-live="polite">
				{tooShort ? (
					<FieldDescription>Type at least {MIN_SEARCH_LENGTH} characters to search.</FieldDescription>
				) : loading ? (
					<p className="text-sm text-muted-foreground" role="status">Searching…</p>
				) : result.failed ? (
					<p className="text-sm text-destructive" role="alert">The search could not be completed. Please try again.</p>
				) : result.hikers.length === 0 ? (
					<div className="space-y-2 rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
						<p>No registered hiker matches “{searched}”.</p>
						<div className="flex flex-wrap justify-center gap-2">
							<Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onUseTemporary}>
								Add a temporary hiker
							</Button>
							{createHikerHref && (
								<Button asChild variant="outline" size="sm">
									<Link to={createHikerHref} viewTransition>Create a full account</Link>
								</Button>
							)}
						</div>
					</div>
				) : (
					<ul className="grid gap-2" aria-label="Hikers found">
						{result.hikers.map((hiker) => (
							<li key={hiker.userId}>
								<Button
									type="button"
									variant="outline"
									className="h-auto w-full justify-start whitespace-normal rounded-xl px-4 py-3 text-left"
									disabled={disabled}
									onClick={() => onSelect(hiker)}
								>
									<HikerSummary user={hiker} />
								</Button>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

function SelectedHiker({ user, onChangeHiker, disabled }) {
	return (
		<div className="flex items-start justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
			<div className="flex min-w-0 items-start gap-3">
				<Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
				<HikerSummary user={user} />
			</div>
			<Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onChangeHiker}>
				Change
			</Button>
		</div>
	);
}

function HikerSummary({ user }) {
	return (
		<span className="flex min-w-0 flex-col gap-0.5">
			<span className="font-medium">{user.fullName}</span>
			<span className="truncate text-sm text-muted-foreground">
				{[user.email, user.phoneNumber].filter(Boolean).join(" · ")}
			</span>
		</span>
	);
}

function TemporaryHikerFields({ value, onChange, disabled }) {
	return (
		<div className="grid gap-4 rounded-xl border border-dashed p-4 sm:grid-cols-2">
			<Field>
				<MandatoryLabel htmlFor="temporary-hiker-name">Name</MandatoryLabel>
				<Input
					id="temporary-hiker-name"
					value={value.name}
					placeholder="e.g. Mario Rossi"
					autoComplete="off"
					disabled={disabled}
					onChange={(event) => onChange({ ...value, name: event.target.value })}
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor="temporary-hiker-phone">Phone (optional)</FieldLabel>
				<PhoneInput
					id="temporary-hiker-phone"
					value={value.phone}
					international
					defaultCountry="IT"
					disabled={disabled}
					onChange={(phone) => onChange({ ...value, phone: phone ?? "" })}
				/>
			</Field>
			<FieldDescription className="sm:col-span-2">
				A temporary hiker has no account and cannot log in. No confirmation email is sent.
			</FieldDescription>
		</div>
	);
}

export default HikerPicker;
