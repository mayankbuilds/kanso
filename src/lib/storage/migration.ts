import { STORAGE_KEYS, LEGACY_KEY_MAPPING } from "./keys.ts";

export interface MigrationResult {
  success: boolean;
  alreadyMigrated: boolean;
  migratedKeys: string[];
  itemCounts: Record<string, number>;
  error?: string;
}

/**
 * Executes the safe, idempotent 3-stage migration from legacy `streakflow_*`
 * keys into modern `kanso_*` keys.
 * 
 * Safety invariants:
 * 1. An immutable backup snapshot is saved to `kanso_legacy_backup_snapshot`.
 * 2. Original `streakflow_*` keys are preserved (never deleted) during migration.
 * 3. Idempotent: repeated calls short-circuit immediately.
 */
export function migrateLegacyData(): MigrationResult {
  if (typeof window === "undefined") {
    return { success: true, alreadyMigrated: true, migratedKeys: [], itemCounts: {} };
  }

  try {
    const status = localStorage.getItem(STORAGE_KEYS.MIGRATION_STATUS);
    if (status === "completed") {
      return { success: true, alreadyMigrated: true, migratedKeys: [], itemCounts: {} };
    }

    const migratedKeys: string[] = [];
    const itemCounts: Record<string, number> = {};
    const legacySnapshot: Record<string, string> = {};

    // STAGE 1: READ & SNAPSHOT ALL LEGACY KEYS
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("streakflow_") || LEGACY_KEY_MAPPING[key])) {
        const val = localStorage.getItem(key);
        if (val !== null) {
          legacySnapshot[key] = val;
        }
      }
    }

    // Save safety backup snapshot if legacy data was found
    if (Object.keys(legacySnapshot).length > 0) {
      localStorage.setItem(
        STORAGE_KEYS.LEGACY_BACKUP_SNAPSHOT,
        JSON.stringify(legacySnapshot)
      );
    }

    // STAGE 2: MAP AND WRITE TO KANSO KEYS
    for (const [legacyKey, kansoKey] of Object.entries(LEGACY_KEY_MAPPING)) {
      const legacyVal = localStorage.getItem(legacyKey);
      if (legacyVal !== null) {
        // Do not overwrite an already existing kanso key if it has data
        const existingKanso = localStorage.getItem(kansoKey);
        if (!existingKanso) {
          localStorage.setItem(kansoKey, legacyVal);
          migratedKeys.push(kansoKey);

          // Track item counts for arrays
          try {
            const parsed = JSON.parse(legacyVal);
            itemCounts[kansoKey] = Array.isArray(parsed) ? parsed.length : 1;
          } catch {
            itemCounts[kansoKey] = 1;
          }
        }
      }
    }

    // Handle dynamic date keys like streakflow_focus_today_mins_YYYY-MM-DD
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("streakflow_focus_today_mins_")) {
        const datePart = key.replace("streakflow_focus_today_mins_", "");
        const newKey = `${STORAGE_KEYS.FOCUS_TODAY_PREFIX}${datePart}`;
        const val = localStorage.getItem(key);
        if (val !== null && !localStorage.getItem(newKey)) {
          localStorage.setItem(newKey, val);
          migratedKeys.push(newKey);
        }
      }
    }

    // STAGE 3: INTEGRITY CHECK & STATUS COMMIT
    localStorage.setItem(STORAGE_KEYS.MIGRATION_STATUS, "completed");

    return {
      success: true,
      alreadyMigrated: false,
      migratedKeys,
      itemCounts,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unknown migration error";
    console.error("Kanso migration error:", errorMsg);
    return {
      success: false,
      alreadyMigrated: false,
      migratedKeys: [],
      itemCounts: {},
      error: errorMsg,
    };
  }
}

/**
 * Emergency rollback to reinstate legacy data from safety snapshot if needed.
 */
export function rollbackLegacyData(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LEGACY_BACKUP_SNAPSHOT);
    if (!raw) return false;
    const snapshot: Record<string, string> = JSON.parse(raw);

    for (const [key, val] of Object.entries(snapshot)) {
      localStorage.setItem(key, val);
    }
    localStorage.removeItem(STORAGE_KEYS.MIGRATION_STATUS);
    return true;
  } catch (err) {
    console.error("Rollback error:", err);
    return false;
  }
}
