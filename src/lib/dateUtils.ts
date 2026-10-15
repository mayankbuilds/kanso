/**
 * Date and calendar utilities for Kanso.
 * 
 * Ensures all calendar date calculations operate strictly on local midnight boundaries,
 * avoiding UTC-vs-local date mismatches that cause streak loss and incorrect rollover.
 */

/**
 * Returns a standardized YYYY-MM-DD date string in the local timezone.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD date string into a local Date object set at local midnight.
 */
export function parseLocalDateString(dateStr: string): Date {
  const parts = dateStr.split("-").map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  }
  return new Date();
}

/**
 * Returns the YYYY-MM-DD string for yesterday in local time.
 */
export function getYesterdayLocalDateString(date: Date = new Date()): string {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
}

/**
 * Returns the YYYY-MM-DD string for tomorrow in local time.
 */
export function getTomorrowLocalDateString(date: Date = new Date()): string {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return getLocalDateString(d);
}

/**
 * Returns true if two dates or date strings fall on the exact same calendar day.
 */
export function isSameDay(d1: string | Date, d2: string | Date): boolean {
  const str1 = typeof d1 === "string" ? d1.slice(0, 10) : getLocalDateString(d1);
  const str2 = typeof d2 === "string" ? d2.slice(0, 10) : getLocalDateString(d2);
  return str1 === str2;
}

/**
 * Calculates the difference in whole calendar days (to - from).
 * Positive means 'to' is in the future relative to 'from'.
 */
export function diffInCalendarDays(from: string | Date, to: string | Date): number {
  const dateFrom = typeof from === "string" ? parseLocalDateString(from.slice(0, 10)) : new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const dateTo = typeof to === "string" ? parseLocalDateString(to.slice(0, 10)) : new Date(to.getFullYear(), to.getMonth(), to.getDate());
  
  const msDiff = dateTo.getTime() - dateFrom.getTime();
  return Math.round(msDiff / (1000 * 60 * 60 * 24));
}

/**
 * Formats a YYYY-MM-DD date string into a human-friendly string:
 * "Today", "Yesterday", "Tomorrow", or e.g. "Mon, Oct 15".
 */
export function formatDisplayDate(dateStr: string, relative: boolean = true): string {
  const today = getLocalDateString();
  const yesterday = getYesterdayLocalDateString();
  const tomorrow = getTomorrowLocalDateString();

  const clean = dateStr.slice(0, 10);
  if (relative) {
    if (clean === today) return "Today";
    if (clean === yesterday) return "Yesterday";
    if (clean === tomorrow) return "Tomorrow";
  }

  const d = parseLocalDateString(clean);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
