export function extractDateTime(text: string) {
  const lower = text.toLowerCase();

  let date = new Date();

  // 📅 Detect day words
  if (lower.includes("tomorrow")) {
    date.setDate(date.getDate() + 1);
  }

  if (lower.includes("today")) {
    // no change
  }

  // 🕒 Extract time (simple)
  const timeMatch = lower.match(/(\d{1,2})(?:\s)?(am|pm)?/);

  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    const period = timeMatch[2];

    if (period === "pm" && hour < 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;

    date.setHours(hour);
    date.setMinutes(0);
  }

  return date;
}
