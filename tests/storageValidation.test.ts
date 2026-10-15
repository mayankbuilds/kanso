import test from "node:test";
import assert from "node:assert";
import {
  STORAGE_KEYS,
  getCodingLogs,
  getDailyFocus,
  getFocusHistory,
  getRoutines,
  getTasks,
  getNotes,
  getUserStats,
} from "../src/lib/storage/index.ts";

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
  (global as unknown as { window: { dispatchEvent: () => boolean } }).window = {
    dispatchEvent: () => true,
  };

  return mockStorage;
}

test("storage validation - malformed non-array JSON returns empty array for array getters", () => {
  const storage = setupMockLocalStorage();

  // Set malformed primitive and object data into array-based stores
  storage.setItem(STORAGE_KEYS.LOGS, JSON.stringify({ not: "an array" }));
  storage.setItem(STORAGE_KEYS.FOCUS, JSON.stringify("string-instead-of-array"));
  storage.setItem(STORAGE_KEYS.FOCUS_HISTORY, JSON.stringify(42));
  storage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(true));
  storage.setItem(STORAGE_KEYS.TASKS, JSON.stringify({ bad: 1 }));
  storage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(null));

  assert.deepStrictEqual(getCodingLogs(), []);
  assert.deepStrictEqual(getDailyFocus(), []);
  assert.deepStrictEqual(getFocusHistory(), []);
  assert.deepStrictEqual(getRoutines(), []);
  assert.deepStrictEqual(getTasks(), []);
  assert.deepStrictEqual(getNotes(), []);
});

test("storage validation - filters out corrupt/null elements inside arrays", () => {
  const storage = setupMockLocalStorage();

  // Array with null, primitives, and invalid objects
  const mixedLogs = [
    null,
    123,
    "garbage",
    { invalid_field: "test" },
    { id: 1, problem_title: "Valid Two Sum", platform: "LeetCode", difficulty: "Easy", topic_tag: "Array", solved_at: "2026-10-15", created_at: "2026-10-15" },
  ];

  storage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(mixedLogs));

  const logs = getCodingLogs();
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].problem_title, "Valid Two Sum");
});

test("storage validation - handles malformed user stats safely with fallback values", () => {
  const storage = setupMockLocalStorage();

  // Corrupt string in user stats store
  storage.setItem(STORAGE_KEYS.USER_STATS, JSON.stringify("corrupt stats"));
  const statsFallback = getUserStats();
  assert.strictEqual(statsFallback.id, 1);
  assert.strictEqual(statsFallback.xp, 100);
  assert.strictEqual(statsFallback.level, 1);

  // Object with NaN or missing fields
  storage.setItem(STORAGE_KEYS.USER_STATS, JSON.stringify({
    id: "not-a-number",
    xp: NaN,
    level: "invalid",
    current_streak_days: -5,
  }));
  const sanitized = getUserStats();
  assert.strictEqual(sanitized.id, 1);
  assert.strictEqual(sanitized.xp, 100);
  assert.strictEqual(sanitized.level, 1);
  assert.strictEqual(sanitized.current_streak_days, -5);
});
