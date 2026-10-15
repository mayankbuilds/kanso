import test from "node:test";
import assert from "node:assert";
import {
  calculateStreakOnActivity,
  getStreakStatus,
} from "../src/lib/storage/streakEngine.ts";
import type { UserStats } from "../src/types/index.ts";

test("streakEngine - first activity ever initializes streak to 1", () => {
  const initialStats: UserStats = {
    id: 1,
    xp: 0,
    level: 1,
    current_streak_days: 0,
    longest_streak_days: 0,
    last_active_date: null,
  };

  const updated = calculateStreakOnActivity(initialStats, "2026-10-15");
  assert.strictEqual(updated.current_streak_days, 1);
  assert.strictEqual(updated.longest_streak_days, 1);
  assert.strictEqual(updated.last_active_date, "2026-10-15");
});

test("streakEngine - multiple activities on the same day maintain the streak without duplicate increments", () => {
  const stats: UserStats = {
    id: 1,
    xp: 100,
    level: 1,
    current_streak_days: 3,
    longest_streak_days: 5,
    last_active_date: "2026-10-15",
  };

  const updated = calculateStreakOnActivity(stats, "2026-10-15");
  assert.strictEqual(updated.current_streak_days, 3);
  assert.strictEqual(updated.longest_streak_days, 5);
  assert.strictEqual(updated.last_active_date, "2026-10-15");
});

test("streakEngine - activity on the consecutive day increments streak by 1", () => {
  const stats: UserStats = {
    id: 1,
    xp: 150,
    level: 1,
    current_streak_days: 3,
    longest_streak_days: 3,
    last_active_date: "2026-10-14",
  };

  const updated = calculateStreakOnActivity(stats, "2026-10-15");
  assert.strictEqual(updated.current_streak_days, 4);
  assert.strictEqual(updated.longest_streak_days, 4);
  assert.strictEqual(updated.last_active_date, "2026-10-15");
});

test("streakEngine - activity after missing a day resets current streak to 1 but retains longest streak", () => {
  const stats: UserStats = {
    id: 1,
    xp: 500,
    level: 2,
    current_streak_days: 10,
    longest_streak_days: 14,
    last_active_date: "2026-10-12", // 3 days ago relative to 2026-10-15
  };

  const updated = calculateStreakOnActivity(stats, "2026-10-15");
  assert.strictEqual(updated.current_streak_days, 1);
  assert.strictEqual(updated.longest_streak_days, 14); // Longest streak preserved!
  assert.strictEqual(updated.last_active_date, "2026-10-15");
});

test("streakEngine - getStreakStatus reports active status for today and yesterday", () => {
  const activeToday: UserStats = {
    id: 1,
    xp: 200,
    level: 1,
    current_streak_days: 5,
    longest_streak_days: 8,
    last_active_date: "2026-10-15",
  };
  const statusToday = getStreakStatus(activeToday, "2026-10-15");
  assert.strictEqual(statusToday.isStreakActive, true);
  assert.strictEqual(statusToday.currentStreak, 5);
  assert.strictEqual(statusToday.daysSinceLastActive, 0);

  const activeYesterday: UserStats = {
    ...activeToday,
    last_active_date: "2026-10-14",
  };
  const statusYesterday = getStreakStatus(activeYesterday, "2026-10-15");
  assert.strictEqual(statusYesterday.isStreakActive, true);
  assert.strictEqual(statusYesterday.currentStreak, 5);
  assert.strictEqual(statusYesterday.daysSinceLastActive, 1);
});

test("streakEngine - getStreakStatus reports 0 for lapsed streak (missed >= 2 days)", () => {
  const missedStats: UserStats = {
    id: 1,
    xp: 300,
    level: 1,
    current_streak_days: 7,
    longest_streak_days: 12,
    last_active_date: "2026-10-13", // 2 days ago
  };

  const status = getStreakStatus(missedStats, "2026-10-15");
  assert.strictEqual(status.isStreakActive, false);
  assert.strictEqual(status.currentStreak, 0); // Lapsed until user acts today
  assert.strictEqual(status.longestStreak, 12);
  assert.strictEqual(status.daysSinceLastActive, 2);
});
