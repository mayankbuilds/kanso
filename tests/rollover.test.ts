import test from "node:test";
import assert from "node:assert";
import { checkAndApplyRollover } from "../src/lib/storage/rollover.ts";
import { STORAGE_KEYS } from "../src/lib/storage/keys.ts";
import type { StudentRoutine, DailyFocus } from "../src/types/index.ts";

// Simple in-memory localStorage mock for node testing
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

  // Attach mock to global
  (global as unknown as { localStorage: typeof mockStorage }).localStorage = mockStorage;
  (global as unknown as { window: { dispatchEvent: () => boolean } }).window = {
    dispatchEvent: () => true,
  };

  return mockStorage;
}

test("rollover - resets routine checkmark if completed on a previous day", () => {
  const storage = setupMockLocalStorage();

  const routines: StudentRoutine[] = [
    {
      id: 1,
      title: "Morning Review",
      start_time: "08:00",
      end_time: "09:00",
      category: "Revision",
      is_completed_today: true,
      last_completed_date: "2026-10-14", // Completed yesterday
      created_at: "2026-10-10",
    },
    {
      id: 2,
      title: "LeetCode Daily",
      start_time: "10:00",
      end_time: "11:00",
      category: "Coding",
      is_completed_today: false,
      last_completed_date: null,
      created_at: "2026-10-10",
    },
  ];

  storage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines));
  storage.setItem(STORAGE_KEYS.LAST_ROLLOVER_DATE, "2026-10-14");

  const result = checkAndApplyRollover(true);
  assert.strictEqual(result.rolledOver, true);

  const updatedRoutines: StudentRoutine[] = JSON.parse(
    storage.getItem(STORAGE_KEYS.ROUTINES) || "[]"
  );

  // Routine 1 should have is_completed_today reset to false
  assert.strictEqual(updatedRoutines[0].is_completed_today, false);
  // Definition and details must remain completely intact
  assert.strictEqual(updatedRoutines[0].title, "Morning Review");
  assert.strictEqual(updatedRoutines[0].category, "Revision");
  // Routine 2 remains unchanged
  assert.strictEqual(updatedRoutines[1].is_completed_today, false);
});

test("rollover - archives completed past focus tasks into history", () => {
  const storage = setupMockLocalStorage();

  const focusTasks: DailyFocus[] = [
    {
      id: 101,
      title: "Yesterday Completed Goal",
      priority_order: 1,
      target_date: "2026-10-14",
      is_completed: true,
      created_at: "2026-10-14",
    },
  ];

  storage.setItem(STORAGE_KEYS.FOCUS, JSON.stringify(focusTasks));
  storage.setItem(STORAGE_KEYS.LAST_ROLLOVER_DATE, "2026-10-14");

  const result = checkAndApplyRollover(true);
  assert.strictEqual(result.rolledOver, true);

  // Active focus slots for today should be empty
  const activeFocus: DailyFocus[] = JSON.parse(
    storage.getItem(STORAGE_KEYS.FOCUS) || "[]"
  );
  assert.strictEqual(activeFocus.length, 0);

  // Completed task must be safely preserved in kanso_focus_history
  const history: DailyFocus[] = JSON.parse(
    storage.getItem(STORAGE_KEYS.FOCUS_HISTORY) || "[]"
  );
  assert.strictEqual(history.length, 1);
  assert.strictEqual(history[0].id, 101);
  assert.strictEqual(history[0].title, "Yesterday Completed Goal");
  assert.strictEqual(history[0].is_completed, true);
});

test("rollover - carries forward unfinished past focus tasks to today", () => {
  const storage = setupMockLocalStorage();

  const focusTasks: DailyFocus[] = [
    {
      id: 201,
      title: "Unfinished Graph Problem",
      priority_order: 1,
      target_date: "2026-10-14",
      is_completed: false,
      created_at: "2026-10-14",
    },
    {
      id: 202,
      title: "Finished Math Practice",
      priority_order: 2,
      target_date: "2026-10-14",
      is_completed: true,
      created_at: "2026-10-14",
    },
  ];

  storage.setItem(STORAGE_KEYS.FOCUS, JSON.stringify(focusTasks));
  storage.setItem(STORAGE_KEYS.LAST_ROLLOVER_DATE, "2026-10-14");

  const result = checkAndApplyRollover(true);
  assert.strictEqual(result.rolledOver, true);

  const activeFocus: DailyFocus[] = JSON.parse(
    storage.getItem(STORAGE_KEYS.FOCUS) || "[]"
  );
  // Unfinished task carried forward to today
  assert.strictEqual(activeFocus.length, 1);
  assert.strictEqual(activeFocus[0].id, 201);
  assert.strictEqual(activeFocus[0].title, "Unfinished Graph Problem");
  assert.strictEqual(activeFocus[0].target_date, result.currentDate);
  assert.strictEqual(activeFocus[0].is_completed, false);

  // Finished task archived to history
  const history: DailyFocus[] = JSON.parse(
    storage.getItem(STORAGE_KEYS.FOCUS_HISTORY) || "[]"
  );
  assert.strictEqual(history.length, 1);
  assert.strictEqual(history[0].id, 202);
});

test("rollover - moves overflow unfinished tasks to backlog when 3 focus slots are full", () => {
  const storage = setupMockLocalStorage();

  // Today already has 3 focus tasks (slots 1, 2, 3)
  const todayTasks: DailyFocus[] = [
    { id: 301, title: "Today 1", priority_order: 1, target_date: "2026-10-15", is_completed: false, created_at: "2026-10-15" },
    { id: 302, title: "Today 2", priority_order: 2, target_date: "2026-10-15", is_completed: false, created_at: "2026-10-15" },
    { id: 303, title: "Today 3", priority_order: 3, target_date: "2026-10-15", is_completed: false, created_at: "2026-10-15" },
    // And an unfinished task from yesterday
    { id: 299, title: "Unfinished Overflow Task", priority_order: 1, target_date: "2026-10-14", is_completed: false, created_at: "2026-10-14" },
  ];

  storage.setItem(STORAGE_KEYS.FOCUS, JSON.stringify(todayTasks));
  storage.setItem(STORAGE_KEYS.LAST_ROLLOVER_DATE, "2026-10-14");

  // Force rollover
  checkAndApplyRollover(true);

  // Today still has its 3 focus tasks
  const activeFocus: DailyFocus[] = JSON.parse(storage.getItem(STORAGE_KEYS.FOCUS) || "[]");
  assert.strictEqual(activeFocus.length, 3);

  // Overflow task was moved to backlog kanso_tasks!
  const backlog = JSON.parse(storage.getItem(STORAGE_KEYS.TASKS) || "[]");
  assert.strictEqual(backlog.length, 1);
  assert.strictEqual(backlog[0].title, "Unfinished Overflow Task");
  assert.strictEqual(backlog[0].isCompleted, false);
});

