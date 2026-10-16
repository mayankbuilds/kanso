import type {
  CodingLog,
  DailyFocus,
  StudentRoutine,
  BacklogTask,
  QuickNote,
} from "../../types/index.ts";
import { STORAGE_KEYS } from "./keys.ts";
import {
  getLocal,
  setLocal,
  broadcastStorageUpdate,
  getCodingLogs,
  getDailyFocus,
  getFocusHistory,
  getRoutines,
  getUserStats,
  getTasks,
  getNotes,
} from "./index.ts";

export interface SnapshotStats {
  id?: number;
  xp: number;
  level: number;
  current_streak_days: number;
  longest_streak_days: number;
  last_active_date: string | null;
}

export interface KansoSnapshotData {
  logs: CodingLog[];
  focus: DailyFocus[];
  focus_history: DailyFocus[];
  routines: StudentRoutine[];
  stats: SnapshotStats;
  tasks: BacklogTask[];
  notes: QuickNote[];
  categories?: string[];
  revision?: number;
}

export interface KansoSnapshot {
  app: "kanso";
  version: "3.0.0";
  synced_at: string;
  revision: number;
  data: KansoSnapshotData;
}

export interface SnapshotCounts {
  logs: number;
  focus: number;
  focus_history: number;
  routines: number;
  tasks: number;
  notes: number;
  xp: number;
  level: number;
  streak: number;
}

export interface SnapshotComparison {
  remoteTimestamp: string;
  localTimestamp: string | null;
  remoteRevision: number;
  localRevision: number;
  remoteCounts: SnapshotCounts;
  localCounts: SnapshotCounts;
  isRemoteNewer: boolean;
  hasConflict: boolean;
}

/**
 * Returns current snapshot revision counter.
 */
export function getStorageRevision(): number {
  return getLocal<number>(STORAGE_KEYS.REVISION_COUNTER, 1);
}

/**
 * Increments the revision counter by 1 and updates last modified timestamp.
 */
export function bumpStorageRevision(): number {
  const next = getStorageRevision() + 1;
  setLocal(STORAGE_KEYS.REVISION_COUNTER, next);
  setLocal(STORAGE_KEYS.LAST_MODIFIED, new Date().toISOString());
  return next;
}

/**
 * Returns current item counts and stats from local storage.
 */
export function getLocalCounts(): SnapshotCounts {
  const logs = getCodingLogs();
  const focus = getDailyFocus();
  const focusHistory = getFocusHistory();
  const routines = getRoutines();
  const tasks = getTasks();
  const notes = getNotes();
  const stats = getUserStats();

  return {
    logs: logs.length,
    focus: focus.length,
    focus_history: focusHistory.length,
    routines: routines.length,
    tasks: tasks.length,
    notes: notes.length,
    xp: stats.xp,
    level: stats.level,
    streak: stats.current_streak_days,
  };
}

/**
 * Calculates item counts and stats from a validated snapshot.
 */
export function getSnapshotCounts(snapshot: KansoSnapshot): SnapshotCounts {
  const d = snapshot.data;
  const stats = d.stats || { xp: 0, level: 1, current_streak_days: 0 };

  return {
    logs: Array.isArray(d.logs) ? d.logs.length : 0,
    focus: Array.isArray(d.focus) ? d.focus.length : 0,
    focus_history: Array.isArray(d.focus_history) ? d.focus_history.length : 0,
    routines: Array.isArray(d.routines) ? d.routines.length : 0,
    tasks: Array.isArray(d.tasks) ? d.tasks.length : 0,
    notes: Array.isArray(d.notes) ? d.notes.length : 0,
    xp: typeof stats.xp === "number" ? stats.xp : 0,
    level: typeof stats.level === "number" ? stats.level : 1,
    streak: typeof stats.current_streak_days === "number" ? stats.current_streak_days : 0,
  };
}

/**
 * Creates a complete, canonical Kanso snapshot from current local storage state.
 */
export function createKansoSnapshot(): KansoSnapshot {
  const revision = getStorageRevision();
  const logs = getCodingLogs();
  const focus = getDailyFocus();
  const focusHistory = getFocusHistory();
  const routines = getRoutines();
  const stats = getUserStats();
  const tasks = getTasks();
  const notes = getNotes();
  const categories = getLocal<string[]>(STORAGE_KEYS.CUSTOM_CATEGORIES, []);

  return {
    app: "kanso",
    version: "3.0.0",
    synced_at: new Date().toISOString(),
    revision,
    data: {
      logs,
      focus,
      focus_history: focusHistory,
      routines,
      stats: {
        id: stats.id,
        xp: stats.xp,
        level: stats.level,
        current_streak_days: stats.current_streak_days,
        longest_streak_days: stats.longest_streak_days,
        last_active_date: stats.last_active_date || null,
      },
      tasks,
      notes,
      categories: Array.isArray(categories) ? categories : [],
      revision,
    },
  };
}

/**
 * Validates and normalizes any raw JSON payload (whether Kanso v3 or legacy StreakFlow v2)
 * into a typed KansoSnapshot.
 */
export function validateSnapshot(raw: unknown): {
  valid: boolean;
  snapshot?: KansoSnapshot;
  error?: string;
} {
  if (!raw || typeof raw !== "object") {
    return { valid: false, error: "Snapshot payload is empty or not a valid JSON object." };
  }

  const obj = raw as Record<string, unknown>;
  const data = (obj.data && typeof obj.data === "object" ? obj.data : obj) as Record<string, unknown>;

  // Check if at least one recognizable core store exists
  const hasRecognizableStore =
    Array.isArray(data.logs) ||
    Array.isArray(data.focus) ||
    Array.isArray(data.routines) ||
    Array.isArray(data.tasks) ||
    Array.isArray(data.notes) ||
    Boolean(data.stats);

  if (!hasRecognizableStore) {
    return {
      valid: false,
      error: "Snapshot missing recognizable Kanso stores (logs, focus, routines, tasks, notes, or stats).",
    };
  }

  const rawStats = (data.stats && typeof data.stats === "object" ? data.stats : {}) as Record<string, unknown>;
  const stats: SnapshotStats = {
    id: typeof rawStats.id === "number" ? rawStats.id : 1,
    xp: typeof rawStats.xp === "number" && !isNaN(rawStats.xp) ? rawStats.xp : 0,
    level: typeof rawStats.level === "number" && !isNaN(rawStats.level) ? rawStats.level : 1,
    current_streak_days:
      typeof rawStats.current_streak_days === "number" && !isNaN(rawStats.current_streak_days)
        ? rawStats.current_streak_days
        : 0,
    longest_streak_days:
      typeof rawStats.longest_streak_days === "number" && !isNaN(rawStats.longest_streak_days)
        ? rawStats.longest_streak_days
        : 0,
    last_active_date: typeof rawStats.last_active_date === "string" ? rawStats.last_active_date : null,
  };

  const syncedAt =
    typeof obj.synced_at === "string"
      ? obj.synced_at
      : typeof data.synced_at === "string"
      ? (data.synced_at as string)
      : new Date().toISOString();

  const revision =
    typeof obj.revision === "number"
      ? obj.revision
      : typeof data.revision === "number"
      ? (data.revision as number)
      : 1;

  const normalized: KansoSnapshot = {
    app: "kanso",
    version: "3.0.0",
    synced_at: syncedAt,
    revision,
    data: {
      logs: Array.isArray(data.logs) ? (data.logs as CodingLog[]) : [],
      focus: Array.isArray(data.focus) ? (data.focus as DailyFocus[]) : [],
      focus_history: Array.isArray(data.focus_history) ? (data.focus_history as DailyFocus[]) : [],
      routines: Array.isArray(data.routines) ? (data.routines as StudentRoutine[]) : [],
      stats,
      tasks: Array.isArray(data.tasks) ? (data.tasks as BacklogTask[]) : [],
      notes: Array.isArray(data.notes) ? (data.notes as QuickNote[]) : [],
      categories: Array.isArray(data.categories) ? (data.categories as string[]) : [],
      revision,
    },
  };

  return { valid: true, snapshot: normalized };
}

/**
 * Compares an incoming snapshot against current local storage state.
 */
export function compareSnapshots(remote: KansoSnapshot): SnapshotComparison {
  const localCounts = getLocalCounts();
  const remoteCounts = getSnapshotCounts(remote);
  const localRevision = getStorageRevision();
  const localLastModified = getLocal<string | null>(STORAGE_KEYS.LAST_MODIFIED, null);
  const localLastSync = getLocal<string | null>(STORAGE_KEYS.DRIVE_LAST_SYNC, null);

  const localEffectiveTime = localLastModified || localLastSync;
  const remoteTime = new Date(remote.synced_at).getTime();
  const localTime = localEffectiveTime ? new Date(localEffectiveTime).getTime() : 0;

  const isRemoteNewer = remoteTime > localTime;
  const hasConflict = remote.revision !== localRevision && !isRemoteNewer;

  return {
    remoteTimestamp: remote.synced_at,
    localTimestamp: localEffectiveTime,
    remoteRevision: remote.revision,
    localRevision,
    remoteCounts,
    localCounts,
    isRemoteNewer,
    hasConflict,
  };
}

/**
 * Safely applies a validated snapshot to localStorage with automatic pre-restore backup.
 */
export function applyKansoSnapshot(snapshot: KansoSnapshot): {
  success: boolean;
  counts: SnapshotCounts;
  error?: string;
} {
  if (typeof window === "undefined") {
    return {
      success: false,
      counts: getSnapshotCounts(snapshot),
      error: "Window / localStorage is not available.",
    };
  }

  try {
    // 1. Create a safety rollback snapshot of current local state first
    const currentBackup = createKansoSnapshot();
    localStorage.setItem(
      STORAGE_KEYS.PRE_RESTORE_BACKUP,
      JSON.stringify(currentBackup)
    );

    const d = snapshot.data;

    // 2. Write all 6 stores to both kanso_* and streakflow_* keys
    if (Array.isArray(d.tasks)) {
      const s = JSON.stringify(d.tasks);
      localStorage.setItem("kanso_tasks", s);
      localStorage.setItem("streakflow_tasks", s);
    }
    if (Array.isArray(d.notes)) {
      const s = JSON.stringify(d.notes);
      localStorage.setItem("kanso_notes", s);
      localStorage.setItem("streakflow_notes", s);
    }
    if (Array.isArray(d.logs)) {
      const s = JSON.stringify(d.logs);
      localStorage.setItem("kanso_logs", s);
      localStorage.setItem("streakflow_logs", s);
    }
    if (Array.isArray(d.focus)) {
      const s = JSON.stringify(d.focus);
      localStorage.setItem("kanso_focus", s);
      localStorage.setItem("streakflow_focus", s);
    }
    if (Array.isArray(d.focus_history)) {
      const s = JSON.stringify(d.focus_history);
      localStorage.setItem("kanso_focus_history", s);
      localStorage.setItem("streakflow_focus_history", s);
    }
    if (Array.isArray(d.routines)) {
      const s = JSON.stringify(d.routines);
      localStorage.setItem("kanso_routines", s);
      localStorage.setItem("streakflow_routines", s);
    }
    if (d.stats && typeof d.stats === "object") {
      const s = JSON.stringify(d.stats);
      localStorage.setItem("kanso_user_stats", s);
      localStorage.setItem("streakflow_user_stats", s);
    }
    if (Array.isArray(d.categories) && d.categories.length > 0) {
      const s = JSON.stringify(d.categories);
      localStorage.setItem("kanso_custom_categories", s);
      localStorage.setItem("streakflow_custom_categories", s);
    }

    // 3. Advance revision and record last sync/modified timestamps
    const targetRevision = Math.max(getStorageRevision(), snapshot.revision || 1);
    localStorage.setItem(STORAGE_KEYS.REVISION_COUNTER, String(targetRevision));
    localStorage.setItem(STORAGE_KEYS.DRIVE_LAST_SYNC, snapshot.synced_at);
    localStorage.setItem(STORAGE_KEYS.LAST_MODIFIED, snapshot.synced_at);

    // 4. Broadcast global update events so all components refresh instantly
    broadcastStorageUpdate("all", { restored: true, timestamp: Date.now() });
    window.dispatchEvent(new Event("streakflow-stats-updated"));
    window.dispatchEvent(
      new CustomEvent("kanso-drive-synced", {
        detail: { timestamp: snapshot.synced_at },
      })
    );

    return {
      success: true,
      counts: getSnapshotCounts(snapshot),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Failed to apply Kanso snapshot:", err);
    return {
      success: false,
      counts: getSnapshotCounts(snapshot),
      error: msg,
    };
  }
}

/**
 * Triggers a browser download of a snapshot as a JSON file.
 */
export function exportSnapshotAsJsonFile(customSnapshot?: KansoSnapshot): void {
  if (typeof window === "undefined") return;
  const snapshot = customSnapshot || createKansoSnapshot();
  const dateStr = snapshot.synced_at.split("T")[0] || "backup";
  const filename = `kanso-backup-${dateStr}.json`;

  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parses a user-selected File into a validated KansoSnapshot.
 */
export async function parseSnapshotFile(file: File): Promise<{
  valid: boolean;
  snapshot?: KansoSnapshot;
  error?: string;
}> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    return validateSnapshot(parsed);
  } catch (err) {
    return {
      valid: false,
      error: `Could not parse file as JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
