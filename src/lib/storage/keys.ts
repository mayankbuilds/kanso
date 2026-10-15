/**
 * Storage keys for Kanso local-first persistence.
 * Standardized under the `kanso_*` namespace.
 */

export const STORAGE_KEYS = {
  // Core business stores
  TASKS: "kanso_tasks",
  NOTES: "kanso_notes",
  LOGS: "kanso_logs",
  FOCUS: "kanso_focus",
  FOCUS_HISTORY: "kanso_focus_history",
  ROUTINES: "kanso_routines",
  USER_STATS: "kanso_user_stats",

  // Focus & Pomodoro preferences & telemetry
  CUSTOM_MUSIC_URL: "kanso_custom_music_url",
  RECENT_MUSIC_URLS: "kanso_recent_music_urls",
  SOUND_ENABLED: "kanso_sound_enabled",
  CUSTOM_FOCUS_MINS: "kanso_custom_focus_mins",
  FOCUS_DURATION: "kanso_focus_duration",
  FOCUS_TOTAL_COMPLETED_MINS: "kanso_focus_total_completed_mins",
  FOCUS_TODAY_PREFIX: "kanso_focus_today_mins_",

  // Routines & categories
  CUSTOM_CATEGORIES: "kanso_custom_categories",

  // Coding arena credentials & cached results
  LC_HANDLE: "kanso_lc_handle",
  CF_HANDLE: "kanso_cf_handle",
  LC_RESULT: "kanso_lc_result",
  CF_RESULT: "kanso_cf_result",
  CACHED_HEATMAP: "kanso_cached_heatmap",

  // Visual theming
  THEME_MODE: "kanso_theme_mode",
  ACCENT_COLOR: "kanso_accent_color",

  // Cloud & synchronization metadata
  DRIVE_LAST_SYNC: "kanso_drive_last_sync",
  DRIVE_AUTOSYNC: "kanso_drive_autosync",
  REVISION_COUNTER: "kanso_revision_counter",

  // Lifecycle & migration
  LAST_ROLLOVER_DATE: "kanso_last_rollover_date",
  MIGRATION_STATUS: "kanso_migration_status",
  LEGACY_BACKUP_SNAPSHOT: "kanso_legacy_backup_snapshot",
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

/**
 * Legacy `streakflow_*` keys mapped to corresponding new keys for migration.
 */
export const LEGACY_KEY_MAPPING: Record<string, string> = {
  streakflow_tasks: STORAGE_KEYS.TASKS,
  streakflow_notes: STORAGE_KEYS.NOTES,
  streakflow_logs: STORAGE_KEYS.LOGS,
  streakflow_focus: STORAGE_KEYS.FOCUS,
  streakflow_focus_history: STORAGE_KEYS.FOCUS_HISTORY,
  streakflow_routines: STORAGE_KEYS.ROUTINES,
  streakflow_user_stats: STORAGE_KEYS.USER_STATS,
  streakflow_custom_music_url: STORAGE_KEYS.CUSTOM_MUSIC_URL,
  streakflow_recent_music_urls: STORAGE_KEYS.RECENT_MUSIC_URLS,
  streakflow_sound_enabled: STORAGE_KEYS.SOUND_ENABLED,
  streakflow_custom_focus_mins: STORAGE_KEYS.CUSTOM_FOCUS_MINS,
  streakflow_focus_duration: STORAGE_KEYS.FOCUS_DURATION,
  streakflow_custom_categories: STORAGE_KEYS.CUSTOM_CATEGORIES,
  streakflow_drive_last_sync: STORAGE_KEYS.DRIVE_LAST_SYNC,
  streakflow_drive_autosync: STORAGE_KEYS.DRIVE_AUTOSYNC,
  streakflow_lc_handle: STORAGE_KEYS.LC_HANDLE,
  streakflow_cf_handle: STORAGE_KEYS.CF_HANDLE,
  streakflow_lc_result: STORAGE_KEYS.LC_RESULT,
  streakflow_cf_result: STORAGE_KEYS.CF_RESULT,
  streakflow_focus_total_completed_mins: STORAGE_KEYS.FOCUS_TOTAL_COMPLETED_MINS,
  streakflow_theme_mode: STORAGE_KEYS.THEME_MODE,
  streakflow_accent_color: STORAGE_KEYS.ACCENT_COLOR,
  streakflow_cached_heatmap: STORAGE_KEYS.CACHED_HEATMAP,
};
