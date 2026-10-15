import type { UserStats } from "../../types/index.ts";
import {
  getLocalDateString,
  diffInCalendarDays,
} from "../dateUtils.ts";

/**
 * Calculates updated streak counters whenever a user completes an activity
 * (logs a problem, finishes a Pomodoro sprint, checks a daily focus task, or checks a routine).
 * 
 * Rules:
 * 1. If last active date == today: streak is maintained (no duplicate increment on same day).
 * 2. If last active date == yesterday (diff == 1): streak increments by 1.
 * 3. If last active date < yesterday (diff > 1) or null: streak resets to 1.
 * 4. Longest streak is updated whenever current streak exceeds it.
 */
export function calculateStreakOnActivity(
  currentStats: UserStats,
  activityDateStr?: string
): UserStats {
  const today = activityDateStr || getLocalDateString();
  const lastActive = currentStats.last_active_date?.slice(0, 10) || null;

  let currentStreak = currentStats.current_streak_days || 0;
  let longestStreak = currentStats.longest_streak_days || 0;

  if (!lastActive) {
    // First recorded activity
    currentStreak = 1;
  } else if (lastActive === today) {
    // Already active today: keep streak
    currentStreak = Math.max(1, currentStreak);
  } else {
    const daysDiff = diffInCalendarDays(lastActive, today);
    if (daysDiff === 1) {
      // Consecutive calendar day
      currentStreak = currentStreak + 1;
    } else if (daysDiff > 1) {
      // Missed at least 1 day: reset streak
      currentStreak = 1;
    }
    // If daysDiff < 0 (clock shift or retroactive log), preserve current
  }

  longestStreak = Math.max(longestStreak, currentStreak);

  return {
    ...currentStats,
    current_streak_days: currentStreak,
    longest_streak_days: longestStreak,
    last_active_date: today,
  };
}

/**
 * Returns the effective live status of a user's streak for UI display without mutating storage.
 * If the user was active yesterday, the streak is alive (waiting for today's action).
 * If the user was active 2+ days ago, the active streak has lapsed and shows 0.
 */
export function getStreakStatus(
  stats: UserStats,
  currentDateStr?: string
): {
  isStreakActive: boolean;
  currentStreak: number;
  longestStreak: number;
  daysSinceLastActive: number;
} {
  const today = currentDateStr || getLocalDateString();
  const lastActive = stats.last_active_date?.slice(0, 10) || null;

  if (!lastActive) {
    return {
      isStreakActive: false,
      currentStreak: 0,
      longestStreak: stats.longest_streak_days || 0,
      daysSinceLastActive: -1,
    };
  }

  const daysDiff = diffInCalendarDays(lastActive, today);

  if (daysDiff === 0) {
    // Already active today
    return {
      isStreakActive: true,
      currentStreak: stats.current_streak_days,
      longestStreak: stats.longest_streak_days,
      daysSinceLastActive: 0,
    };
  } else if (daysDiff === 1) {
    // Active yesterday - streak is still alive!
    return {
      isStreakActive: true,
      currentStreak: stats.current_streak_days,
      longestStreak: stats.longest_streak_days,
      daysSinceLastActive: 1,
    };
  } else {
    // Lapsed streak
    return {
      isStreakActive: false,
      currentStreak: 0,
      longestStreak: stats.longest_streak_days,
      daysSinceLastActive: daysDiff,
    };
  }
}
