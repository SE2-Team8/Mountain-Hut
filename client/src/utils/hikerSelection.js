// who a reservation made by an employee is for:
// - a registered hiker found with the search: { mode: "REGISTERED", user } (user is null until one is chosen)
// - a temporary hiker, with only a name and maybe a phone: { mode: "TEMPORARY", name, phone }

export const HikerMode = Object.freeze({
	REGISTERED: "REGISTERED",
	TEMPORARY: "TEMPORARY",
});

export const emptyHikerSelection = () => ({ mode: HikerMode.REGISTERED, user: null });

export const emptyTemporaryHiker = () => ({ mode: HikerMode.TEMPORARY, name: "", phone: "" });

// returns the message to show when the selection is not complete, or null when it is valid
export function getHikerSelectionError(selection) {
	if (selection?.mode === HikerMode.TEMPORARY)
		return selection.name?.trim() ? null : "Enter the name of the hiker";

	return selection?.user ? null : "Search and choose the hiker";
}

// the fields of the reservation body that say who the reservation is for (POST /api/reservations):
// - registered hiker: the userId of the hiker
// - temporary hiker: the userId of the logged employee, plus tmpHikerName and tmpHikerPhone (if given)
export function hikerSelectionToReservationFields(selection, staffUserId) {
	if (selection.mode === HikerMode.REGISTERED)
		return { userId: selection.user.userId };

	const fields = { userId: staffUserId, tmpHikerName: selection.name.trim() };
	if (selection.phone) fields.tmpHikerPhone = selection.phone;
	return fields;
}