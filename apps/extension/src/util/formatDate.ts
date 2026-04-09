export function formatDateThai(value: Date | string | null) {
    if (!value) {
        return "-";
    }

    const dateValue = typeof value === "string" ? new Date(value) : value;

    return new Intl.DateTimeFormat("th-TH", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Bangkok"
    }).format(dateValue);
}