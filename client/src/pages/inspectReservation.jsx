import api from "@/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Controller, useForm } from "react-hook-form";
import { useNavigate, useParams, Link } from "react-router";

import * as zod from 'zod';
import { zodResolver } from "@hookform/resolvers/zod";
import "../assets/css/auth.css"
import { useEffect, useState } from "react";

function PageInspectReservation() {
	const navigate = useNavigate();
	const { reservation_id } = useParams();

	// if no reservation id is set, go to error page
	if (!reservation_id) {
		navigate("/error");
	}

	// reservation data
	const [reservation, setReservation] = useState(null);
	const [reservationLoaded, setReservationLoaded] = useState(false);

	// update the reservation by fetching it from the server from its id whenever it changes
	useEffect(() => {
		const getReservation = async () => {
			try {
				const reserv = await api.reservations.get(reservation_id);
				setReservation(reserv);
				setReservationLoaded(true);
			} catch(err) {
				navigate("/error");
			}
		}

		// if there is no reservation, fetch it
		if (!reservation)
			getReservation();
		
	}, [reservation]);

	// TODO: rewrite the whole page below
	return (
	<Card>
		<CardHeader>
		<CardTitle>Your reservation</CardTitle>
		<CardDescription>
			All the details are available below
		</CardDescription>
		</CardHeader>
		<CardContent>
		{ reservationLoaded ?
			<pre className="overflow-auto rounded-md bg-muted p-4 text-sm">
				{JSON.stringify(reservation, null, 2)}
			</pre>
			: 
			<pre className="overflow-auto rounded-md bg-muted p-4 text-sm">No reservation loaded</pre>
		}
		</CardContent>
	</Card>
	)
}

export default PageInspectReservation;