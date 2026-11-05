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

export { timestampFormat, formatDateTime }