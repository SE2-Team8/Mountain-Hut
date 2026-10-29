// converts a Date object into a ISO string
function dateToStringISO(dateTime) {
	return dateTime.toISOString().slice(0, 19) + 'Z';
}

// converts a ISO string into a Date object
function stringISOToDate(isoStr) {
	return new Date(isoStr);
}

export { dateToStringISO, stringISOToDate}