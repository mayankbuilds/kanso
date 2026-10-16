import type {
  CodingLog,
  DailyFocus,
  StudentRoutine,
  UserStats,
  BacklogTask,
  QuickNote,
} from "../../types/index.ts";
import { STORAGE_KEYS, LEGACY_KEY_MAPPING } from "./keys.ts";
import { migrateLegacyData } from "./migration.ts";
import { checkAndApplyRollover } from "./rollover.ts";
import { calculateStreakOnActivity } from "./streakEngine.ts";
import { getLocalDateString } from "../dateUtils.ts";

export * from "./keys.ts";
export * from "./migration.ts";
export * from "./rollover.ts";
export * from "./streakEngine.ts";
export * from "./snapshot.ts";

/**
 * Generic local storage getter with JSON parse and fallback.
 * Checks modern kanso_* key first, then falls back to legacy streakflow_* key.
 */
export function getLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    let raw = localStorage.getItem(key);
    if (raw === null) {
      // Check legacy counterpart if available
      const legacyKey = Object.keys(LEGACY_KEY_MAPPING).find(
        (k) => LEGACY_KEY_MAPPING[k] === key
      );
      if (legacyKey) {
        raw = localStorage.getItem(legacyKey);
      }
    }
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Generic local storage setter with JSON stringify and custom event dispatch.
 * Also keeps legacy key in sync for backwards compatibility during transition.
 */
export function setLocal<T>(key: string, val: T): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(val);
    localStorage.setItem(key, serialized);

    // Keep legacy key synced as safety net
    const legacyKey = Object.keys(LEGACY_KEY_MAPPING).find(
      (k) => LEGACY_KEY_MAPPING[k] === key
    );
    if (legacyKey) {
      localStorage.setItem(legacyKey, serialized);
    }

    broadcastStorageUpdate(key, val);
  } catch (err) {
    console.warn(`Failed to write to localStorage for key ${key}:`, err);
  }
}

/**
 * Removes an item from localStorage.
 */
export function removeLocal(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
    const legacyKey = Object.keys(LEGACY_KEY_MAPPING).find(
      (k) => LEGACY_KEY_MAPPING[k] === key
    );
    if (legacyKey) {
      localStorage.removeItem(legacyKey);
    }
    broadcastStorageUpdate(key, null);
  } catch {}
}

/**
 * Dispatches an event across the window to notify components of storage mutation.
 */
export function broadcastStorageUpdate(key: string, detail?: unknown): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("kanso-storage-updated", {
      detail: { key, value: detail, timestamp: Date.now() },
    })
  );
}

// ==========================================
// Specialized Core Data Store Accessors
// ==========================================

export function getCodingLogs(): CodingLog[] {
  const data = getLocal<CodingLog[]>(STORAGE_KEYS.LOGS, []);
  if (!Array.isArray(data)) return [];
  return data.filter(
    (item): item is CodingLog =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as CodingLog).problem_title === "string"
  );
}

export function setCodingLogs(logs: CodingLog[]): void {
  setLocal(STORAGE_KEYS.LOGS, Array.isArray(logs) ? logs : []);
}

export function getDailyFocus(): DailyFocus[] {
  const data = getLocal<DailyFocus[]>(STORAGE_KEYS.FOCUS, []);
  if (!Array.isArray(data)) return [];
  return data.filter(
    (item): item is DailyFocus =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as DailyFocus).title === "string"
  );
}

export function setDailyFocus(focusTasks: DailyFocus[]): void {
  setLocal(STORAGE_KEYS.FOCUS, Array.isArray(focusTasks) ? focusTasks : []);
}

export function getFocusHistory(): DailyFocus[] {
  const data = getLocal<DailyFocus[]>(STORAGE_KEYS.FOCUS_HISTORY, []);
  if (!Array.isArray(data)) return [];
  return data.filter(
    (item): item is DailyFocus =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as DailyFocus).title === "string"
  );
}

export function setFocusHistory(history: DailyFocus[]): void {
  setLocal(STORAGE_KEYS.FOCUS_HISTORY, Array.isArray(history) ? history : []);
}

export function getRoutines(): StudentRoutine[] {
  const data = getLocal<StudentRoutine[]>(STORAGE_KEYS.ROUTINES, []);
  if (!Array.isArray(data)) return [];
  return data.filter(
    (item): item is StudentRoutine =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as StudentRoutine).title === "string"
  );
}

export function setRoutines(routines: StudentRoutine[]): void {
  setLocal(STORAGE_KEYS.ROUTINES, Array.isArray(routines) ? routines : []);
}

export function getTasks(): BacklogTask[] {
  const data = getLocal<BacklogTask[]>(STORAGE_KEYS.TASKS, []);
  if (!Array.isArray(data)) return [];
  return data.filter(
    (item): item is BacklogTask =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as BacklogTask).title === "string"
  );
}

export function setTasks(tasks: BacklogTask[]): void {
  setLocal(STORAGE_KEYS.TASKS, Array.isArray(tasks) ? tasks : []);
}

export function getNotes(): QuickNote[] {
  const data = getLocal<QuickNote[]>(STORAGE_KEYS.NOTES, []);
  if (!Array.isArray(data)) return [];
  return data.filter(
    (item): item is QuickNote =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as QuickNote).content === "string"
  );
}

export function setNotes(notes: QuickNote[]): void {
  setLocal(STORAGE_KEYS.NOTES, Array.isArray(notes) ? notes : []);
}

export function getUserStats(): UserStats {
  const fallback: UserStats = {
    id: 1,
    xp: 100,
    level: 1,
    current_streak_days: 0,
    longest_streak_days: 0,
    last_active_date: null,
  };
  const data = getLocal<UserStats>(STORAGE_KEYS.USER_STATS, fallback);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return fallback;
  }
  return {
    id: typeof data.id === "number" ? data.id : fallback.id,
    xp: typeof data.xp === "number" && !isNaN(data.xp) ? data.xp : fallback.xp,
    level: typeof data.level === "number" && !isNaN(data.level) ? data.level : fallback.level,
    current_streak_days:
      typeof data.current_streak_days === "number" && !isNaN(data.current_streak_days)
        ? data.current_streak_days
        : fallback.current_streak_days,
    longest_streak_days:
      typeof data.longest_streak_days === "number" && !isNaN(data.longest_streak_days)
        ? data.longest_streak_days
        : fallback.longest_streak_days,
    last_active_date:
      typeof data.last_active_date === "string" || data.last_active_date === null
        ? data.last_active_date
        : fallback.last_active_date,
  };
}

export function setUserStats(stats: UserStats): void {
  setLocal(STORAGE_KEYS.USER_STATS, stats);
}

/**
 * High-level helper to award XP and record user activity.
 * Automatically increments streaks, advances levels, and dispatches updates.
 */
export function recordUserActivity(deltaXP: number): UserStats {
  const current = getUserStats();
  const withStreak = calculateStreakOnActivity(current);
  const newXP = Math.max(0, withStreak.xp + deltaXP);
  const newLevel = Math.floor(newXP / 300) + 1;

  const updated: UserStats = {
    ...withStreak,
    xp: newXP,
    level: newLevel,
    last_active_date: getLocalDateString(),
  };

  setUserStats(updated);
  return updated;
}

/**
 * Main initialization routine for Kanso storage:
 * Runs idempotent legacy data migration and daily boundary rollover.
 */
export function initKansoStorage(): {
  migrated: boolean;
  rolledOver: boolean;
} {
  if (typeof window === "undefined") {
    return { migrated: false, rolledOver: false };
  }

  const migration = migrateLegacyData();
  const rollover = checkAndApplyRollover();

  return {
    migrated: migration.success && !migration.alreadyMigrated,
    rolledOver: rollover.rolledOver,
  };
}
