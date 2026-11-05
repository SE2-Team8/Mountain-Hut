// converts a Date object into a ISO string
function dateToStringISO(dateTime) {
	return dateTime.toISOString().slice(0, 19) + 'Z';
}

// converts a ISO string into a Date object
function stringISOToDate(isoStr) {
	return new Date(isoStr);
}

function formatDateTime(date) {
    return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Europe/Rome"
    }).format(new Date(date)).replace(" at ", " at ");
}

export { dateToStringISO, stringISOToDate, formatDateTime}