function timestampFormat(timestamp) {
    return timestamp ? new Date(timestamp * 1000).toLocaleDateString('en-US', { dateStyle: 'medium' }) : null;
}

const formatDateTime = (isoString) => {
  return new Date(isoString).toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};


const dateAndTimeStringsToDate = (dateString, timeString) => {
	const [year, month, day] = dateString.split('-').map(Number);
	const [hours, minutes] = timeString.split(':').map(Number);
	const minutesFromDayStart = hours * 60 + minutes;
	return new Date(Date.UTC(year, month - 1, day, hours, minutes));
}

export { timestampFormat, formatDateTime, dateAndTimeStringsToDate }