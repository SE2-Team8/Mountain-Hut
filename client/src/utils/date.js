function timestampFormat(timestamp) {
    return timestamp ? new Date(timestamp * 1000).toLocaleDateString('en-US', { dateStyle: 'medium' }) : null;
}

export { timestampFormat }