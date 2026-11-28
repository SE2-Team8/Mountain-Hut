import { isValidPhoneNumber } from "react-phone-number-input";

// the phone of a temporary hiker is optional, but it must be valid
export function getTemporaryPhoneError(phone) {
	return phone && !isValidPhoneNumber(phone) ? "Invalid phone number" : null;
}

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
	if (selection?.mode === HikerMode.TEMPORARY) {
		if (!selection.name?.trim()) return "Enter the name of the hiker";
		return getTemporaryPhoneError(selection.phone);
	}
	
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