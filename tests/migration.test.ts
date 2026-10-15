import test from "node:test";
import assert from "node:assert";
import {
  migrateLegacyData,
  rollbackLegacyData,
} from "../src/lib/storage/migration.ts";
import { STORAGE_KEYS } from "../src/lib/storage/keys.ts";

function setupMockLocalStorage() {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, val),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };

  (global as unknown as { localStorage: typeof mockStorage }).localStorage = mockStorage;
  (global as unknown as { window: unknown }).window = {};

  return mockStorage;
}

test("migration - safely migrates legacy streakflow keys to kanso keys with backup snapshot", () => {
  const storage = setupMockLocalStorage();

  // Populate legacy mock records
  storage.setItem(
    "streakflow_tasks",
    JSON.stringify([{ id: "1", title: "Legacy Task", isCompleted: false }])
  );
  storage.setItem(
    "streakflow_notes",
    JSON.stringify([{ id: "n1", title: "Legacy Note", content: "Code memo" }])
  );
  storage.setItem(
    "streakflow_logs",
    JSON.stringify([{ id: 10, problem_title: "Two Sum", platform: "LeetCode" }])
  );
  storage.setItem(
    "streakflow_user_stats",
    JSON.stringify({ id: 1, xp: 450, level: 2, current_streak_days: 1 })
  );
  storage.setItem("streakflow_custom_music_url", "https://radio.stream");

  // Run migration
  const result = migrateLegacyData();
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.alreadyMigrated, false);

  // Assert target kanso_* keys exist with correct data
  assert.deepStrictEqual(
    JSON.parse(storage.getItem(STORAGE_KEYS.TASKS)!),
    [{ id: "1", title: "Legacy Task", isCompleted: false }]
  );
  assert.deepStrictEqual(
    JSON.parse(storage.getItem(STORAGE_KEYS.NOTES)!),
    [{ id: "n1", title: "Legacy Note", content: "Code memo" }]
  );
  assert.deepStrictEqual(
    JSON.parse(storage.getItem(STORAGE_KEYS.LOGS)!),
    [{ id: 10, problem_title: "Two Sum", platform: "LeetCode" }]
  );
  assert.strictEqual(
    storage.getItem(STORAGE_KEYS.CUSTOM_MUSIC_URL),
    "https://radio.stream"
  );

  // Assert safety backup snapshot was created
  assert.notStrictEqual(storage.getItem(STORAGE_KEYS.LEGACY_BACKUP_SNAPSHOT), null);

  // Assert original legacy keys are preserved (safety fallback)
  assert.notStrictEqual(storage.getItem("streakflow_tasks"), null);
  assert.notStrictEqual(storage.getItem("streakflow_notes"), null);

  // Assert status committed
  assert.strictEqual(storage.getItem(STORAGE_KEYS.MIGRATION_STATUS), "completed");
});

test("migration - is idempotent on subsequent runs", () => {
  const storage = setupMockLocalStorage();

  storage.setItem("streakflow_tasks", JSON.stringify([{ id: "1" }]));
  migrateLegacyData();

  // Run a second time
  const secondResult = migrateLegacyData();
  assert.strictEqual(secondResult.success, true);
  assert.strictEqual(secondResult.alreadyMigrated, true);
  assert.strictEqual(secondResult.migratedKeys.length, 0);
});

test("migration - rollback reinstates legacy data from snapshot", () => {
  const storage = setupMockLocalStorage();

  storage.setItem("streakflow_tasks", JSON.stringify([{ id: "orig" }]));
  migrateLegacyData();

  // Corrupt or clear legacy key
  storage.removeItem("streakflow_tasks");
  assert.strictEqual(storage.getItem("streakflow_tasks"), null);

  // Rollback
  const rolledBack = rollbackLegacyData();
  assert.strictEqual(rolledBack, true);
  assert.notStrictEqual(storage.getItem("streakflow_tasks"), null);
  assert.strictEqual(storage.getItem(STORAGE_KEYS.MIGRATION_STATUS), null);
});
