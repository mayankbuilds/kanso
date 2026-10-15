import test from "node:test";
import assert from "node:assert";
import {
  getLocalDateString,
  parseLocalDateString,
  isSameDay,
  diffInCalendarDays,
  getYesterdayLocalDateString,
  getTomorrowLocalDateString,
  formatDisplayDate,
} from "../src/lib/dateUtils.ts";

test("dateUtils - getLocalDateString formats local date accurately", () => {
  const d = new Date(2026, 9, 15, 14, 30, 0); // Oct 15, 2026
  const str = getLocalDateString(d);
  assert.strictEqual(str, "2026-10-15");
});

test("dateUtils - parseLocalDateString parses YYYY-MM-DD into midnight local date", () => {
  const parsed = parseLocalDateString("2026-10-15");
  assert.strictEqual(parsed.getFullYear(), 2026);
  assert.strictEqual(parsed.getMonth(), 9); // October (0-indexed)
  assert.strictEqual(parsed.getDate(), 15);
  assert.strictEqual(parsed.getHours(), 0);
});

test("dateUtils - isSameDay correctly checks day identity", () => {
  const d1 = new Date(2026, 9, 15, 10, 0, 0);
  const d2 = new Date(2026, 9, 15, 23, 59, 59);
  const d3 = new Date(2026, 9, 16, 0, 0, 1);

  assert.strictEqual(isSameDay(d1, d2), true);
  assert.strictEqual(isSameDay(d1, "2026-10-15"), true);
  assert.strictEqual(isSameDay(d1, d3), false);
});

test("dateUtils - diffInCalendarDays calculates whole day differences across daylight hours", () => {
  assert.strictEqual(diffInCalendarDays("2026-10-14", "2026-10-15"), 1);
  assert.strictEqual(diffInCalendarDays("2026-10-15", "2026-10-15"), 0);
  assert.strictEqual(diffInCalendarDays("2026-10-15", "2026-10-14"), -1);
  assert.strictEqual(diffInCalendarDays("2026-10-10", "2026-10-15"), 5);
});

test("dateUtils - yesterday and tomorrow helpers calculate contiguous days", () => {
  const base = new Date(2026, 9, 15, 12, 0, 0);
  assert.strictEqual(getYesterdayLocalDateString(base), "2026-10-14");
  assert.strictEqual(getTomorrowLocalDateString(base), "2026-10-16");
});

test("dateUtils - formatDisplayDate returns friendly labels", () => {
  const today = getLocalDateString();
  const yesterday = getYesterdayLocalDateString();
  const tomorrow = getTomorrowLocalDateString();

  assert.strictEqual(formatDisplayDate(today), "Today");
  assert.strictEqual(formatDisplayDate(yesterday), "Yesterday");
  assert.strictEqual(formatDisplayDate(tomorrow), "Tomorrow");
});
