import { useState } from "react";
import { Navigate, useLocation } from "react-router";
import { UserRoundCheck } from "lucide-react";
import HikerPicker from "@/components/ui/hikerPicker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup, FieldSeparator } from "@/components/ui/field";
import useUserStore from "@/store/user";
import { HikerMode, emptyHikerSelection, getHikerSelectionError } from "@/utils/hikerSelection";

const STAFF_ROLES = new Set(["EMPLOYEE", "WARDEN"]);

// a reservation entered by an employee:
function PageBookForHiker() {
	const user = useUserStore((state) => state.user);
	const location = useLocation();
	// a hiker just created in the "new hiker account" page arrives already chosen
	const [hikerSelection, setHikerSelection] = useState(() =>
		location.state?.hiker ? { mode: HikerMode.REGISTERED, user: location.state.hiker } : emptyHikerSelection()
	);
	// the error of the first part is shown only after the first attempt to confirm
	const [showHikerError, setShowHikerError] = useState(false);

	if (!user) return <Navigate to="/auth/login" replace />;
	if (!STAFF_ROLES.has(user.role)) return <Navigate to="/" replace />;

	const hikerError = getHikerSelectionError(hikerSelection);

	return (
		<section className="mx-auto max-w-3xl py-8">
			<Card className="border-white/70 bg-card/95 shadow-xl shadow-black/5 backdrop-blur-sm">
				<CardHeader>
					<CardTitle>Book for a hiker</CardTitle>
					<CardDescription>
						Enter a reservation received by phone, by message or at the hut. Choose the hiker first, then the reservation details.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<HikerPicker
							value={hikerSelection}
							onChange={setHikerSelection}
							error={showHikerError ? hikerError : null}
							createHikerHref="/hikers/new"
						/>

						<FieldSeparator />

						{/*
							TODO: reserve for an hiker
						*/}
						<ReservationFor selection={hikerSelection} hikerError={hikerError} onShowError={() => setShowHikerError(true)} />
					</FieldGroup>
				</CardContent>
			</Card>
		</section>
	);
}

// shows who the reservation is for
function ReservationFor({ selection, hikerError }) {
	if (hikerError) {
		return (
			<p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
				Choose the hiker to continue with the reservation details.{" "}
			</p>
		);
	}

	const name = selection.mode === HikerMode.REGISTERED ? selection.user.fullName : selection.name.trim();
	const kind = selection.mode === HikerMode.REGISTERED ? "registered hiker" : "temporary hiker";

	return (
		<div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
			<UserRoundCheck aria-hidden="true" className="size-5 shrink-0 text-primary" />
			<p>
				Booking for <strong>{name}</strong> <span className="text-muted-foreground">({kind})</span>.
			</p>
		</div>
	);
}

export default PageBookForHiker;