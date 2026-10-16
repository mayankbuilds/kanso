import test from "node:test";
import assert from "node:assert";
import {
  createKansoSnapshot,
  validateSnapshot,
  compareSnapshots,
  applyKansoSnapshot,
  getStorageRevision,
  bumpStorageRevision,
  getLocalCounts,
  getSnapshotCounts,
} from "../src/lib/storage/snapshot.ts";
import { STORAGE_KEYS } from "../src/lib/storage/keys.ts";
import type {
  CodingLog,
  DailyFocus,
  StudentRoutine,
  BacklogTask,
  QuickNote,
} from "../src/types/index.ts";

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

  const dispatchedEvents: Array<{ name: string; detail?: unknown }> = [];
  const mockWindow = {
    dispatchEvent: (event: Event) => {
      dispatchedEvents.push({
        name: event.type,
        detail: (event as CustomEvent).detail,
      });
      return true;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  (globalThis as unknown as { localStorage: typeof mockStorage }).localStorage = mockStorage;
  (globalThis as unknown as { window: typeof mockWindow }).window = mockWindow;

  return { store, dispatchedEvents };
}

test("snapshot - creates canonical Kanso v3 snapshot from local storage state", () => {
  const { store } = setupMockLocalStorage();

  const mockLogs: CodingLog[] = [
    {
      id: 1,
      problem_title: "Two Sum",
      platform: "leetcode",
      difficulty: "Easy",
      topic_tag: "arrays",
      solved_at: "2026-10-15",
      created_at: "2026-10-15",
    },
  ];
  const mockTasks: BacklogTask[] = [
    {
      id: "task-1",
      title: "Review Dynamic Programming",
      category: "General",
      isCompleted: false,
      priority: "High",
      createdAt: "2026-10-15",
    },
  ];
  const mockNotes: QuickNote[] = [
    {
      id: "note-1",
      title: "Binary Search Template",
      content: "- [ ] Mid calculation",
      tags: ["algorithm"],
      isPinned: true,
      updatedAt: "2026-10-15T12:00:00Z",
    },
  ];
  const mockFocus: DailyFocus[] = [
    {
      id: 1,
      title: "Solve 2 Graph Problems",
      target_date: "2026-10-15",
      priority_order: 1,
      is_completed: true,
      created_at: "2026-10-15",
    },
  ];
  const mockRoutines: StudentRoutine[] = [
    {
      id: 1,
      title: "Morning Review",
      start_time: "08:00",
      end_time: "08:30",
      category: "Daily",
      is_completed_today: true,
      created_at: "2026-10-15",
    },
  ];

  store.set(STORAGE_KEYS.LOGS, JSON.stringify(mockLogs));
  store.set(STORAGE_KEYS.TASKS, JSON.stringify(mockTasks));
  store.set(STORAGE_KEYS.NOTES, JSON.stringify(mockNotes));
  store.set(STORAGE_KEYS.FOCUS, JSON.stringify(mockFocus));
  store.set(STORAGE_KEYS.ROUTINES, JSON.stringify(mockRoutines));
  store.set(
    STORAGE_KEYS.USER_STATS,
    JSON.stringify({
      id: 1,
      xp: 450,
      level: 2,
      current_streak_days: 5,
      longest_streak_days: 10,
      last_active_date: "2026-10-15",
    })
  );

  const localCounts = getLocalCounts();
  assert.strictEqual(localCounts.logs, 1);
  assert.strictEqual(localCounts.tasks, 1);
  assert.strictEqual(localCounts.notes, 1);
  assert.strictEqual(localCounts.focus, 1);
  assert.strictEqual(localCounts.routines, 1);
  assert.strictEqual(localCounts.xp, 450);

  const snapshot = createKansoSnapshot();

  assert.strictEqual(snapshot.app, "kanso");
  assert.strictEqual(snapshot.version, "3.0.0");
  assert.ok(typeof snapshot.synced_at === "string");
  assert.strictEqual(snapshot.data.logs.length, 1);
  assert.strictEqual(snapshot.data.tasks.length, 1);
  assert.strictEqual(snapshot.data.notes.length, 1);
  assert.strictEqual(snapshot.data.focus.length, 1);
  assert.strictEqual(snapshot.data.routines.length, 1);
  assert.strictEqual(snapshot.data.stats.xp, 450);
  assert.strictEqual(snapshot.data.stats.level, 2);
  assert.strictEqual(snapshot.data.stats.current_streak_days, 5);

  const snapshotCounts = getSnapshotCounts(snapshot);
  assert.strictEqual(snapshotCounts.logs, 1);
  assert.strictEqual(snapshotCounts.xp, 450);
});

test("snapshot - validates and normalizes legacy streakflow snapshots", () => {
  setupMockLocalStorage();

  const legacyPayload = {
    synced_at: "2026-10-14T10:00:00.000Z",
    version: "2.1.0",
    data: {
      logs: [{ id: 101, problem_title: "Valid Anagram" }],
      focus: [],
      routines: [],
      tasks: [{ id: "task-legacy", title: "Study Trees", category: "General", isCompleted: false, priority: "High", createdAt: "2026-10-14" }],
      notes: [],
      stats: { xp: 200, level: 1, current_streak_days: 3 },
    },
  };

  const res = validateSnapshot(legacyPayload);
  assert.strictEqual(res.valid, true);
  assert.ok(res.snapshot);
  assert.strictEqual(res.snapshot?.app, "kanso");
  assert.strictEqual(res.snapshot?.version, "3.0.0");
  assert.strictEqual(res.snapshot?.data.logs.length, 1);
  assert.strictEqual(res.snapshot?.data.tasks.length, 1);
  assert.strictEqual(res.snapshot?.data.stats.xp, 200);
});

test("snapshot - rejects completely invalid or empty payloads", () => {
  setupMockLocalStorage();

  assert.strictEqual(validateSnapshot(null).valid, false);
  assert.strictEqual(validateSnapshot("not json").valid, false);
  assert.strictEqual(validateSnapshot({}).valid, false);
  assert.strictEqual(validateSnapshot({ data: { unrelated: 123 } }).valid, false);
});

test("snapshot - compares remote snapshot vs local state and detects newer remote", () => {
  const { store } = setupMockLocalStorage();

  store.set(STORAGE_KEYS.DRIVE_LAST_SYNC, "2026-10-15T08:00:00.000Z");
  store.set(STORAGE_KEYS.REVISION_COUNTER, "2");

  assert.strictEqual(getStorageRevision(), 2);

  const remoteSnapshot = createKansoSnapshot();
  remoteSnapshot.synced_at = "2026-10-15T12:00:00.000Z";
  remoteSnapshot.revision = 3;

  const comp = compareSnapshots(remoteSnapshot);

  assert.strictEqual(comp.isRemoteNewer, true);
  assert.strictEqual(comp.remoteRevision, 3);
  assert.strictEqual(comp.localRevision, 2);
});

test("snapshot - applies snapshot with safety rollback backup and broadcasts events", () => {
  const { store, dispatchedEvents } = setupMockLocalStorage();

  // Existing local state
  store.set(
    STORAGE_KEYS.TASKS,
    JSON.stringify([
      {
        id: "old-task",
        title: "Old Backlog Task",
        category: "General",
        isCompleted: false,
        priority: "Medium",
        createdAt: "2026-10-14",
      },
    ])
  );
  store.set(STORAGE_KEYS.REVISION_COUNTER, "1");

  // Remote snapshot to restore
  const remoteSnapshot = createKansoSnapshot();
  remoteSnapshot.synced_at = "2026-10-15T15:00:00.000Z";
  remoteSnapshot.revision = 5;
  remoteSnapshot.data.tasks = [
    {
      id: "new-1",
      title: "Restored Task 1",
      category: "General",
      isCompleted: false,
      priority: "High",
      createdAt: "2026-10-15",
    },
    {
      id: "new-2",
      title: "Restored Task 2",
      category: "General",
      isCompleted: true,
      priority: "Low",
      createdAt: "2026-10-15",
    },
  ];
  remoteSnapshot.data.stats = {
    xp: 600,
    level: 3,
    current_streak_days: 7,
    longest_streak_days: 14,
    last_active_date: "2026-10-15",
  };

  const res = applyKansoSnapshot(remoteSnapshot);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.counts.tasks, 2);
  assert.strictEqual(res.counts.xp, 600);

  // Check that pre-restore backup was preserved in storage
  const rollbackRaw = store.get(STORAGE_KEYS.PRE_RESTORE_BACKUP);
  assert.ok(rollbackRaw, "Rollback backup must be preserved");
  const rollback = JSON.parse(rollbackRaw!);
  assert.strictEqual(rollback.data.tasks[0].title, "Old Backlog Task");

  // Check that both kanso_* and streakflow_* keys were updated
  assert.strictEqual(
    JSON.parse(store.get(STORAGE_KEYS.TASKS)!).length,
    2
  );
  assert.strictEqual(
    JSON.parse(store.get("streakflow_tasks")!).length,
    2
  );

  // Check revision counter updated
  assert.strictEqual(store.get(STORAGE_KEYS.REVISION_COUNTER), "5");

  // Check that events were dispatched
  const eventNames = dispatchedEvents.map((e) => e.name);
  assert.ok(eventNames.includes("kanso-storage-updated"));
  assert.ok(eventNames.includes("streakflow-stats-updated"));
  assert.ok(eventNames.includes("kanso-drive-synced"));
});

test("snapshot - bumpStorageRevision increments revision and updates last modified", () => {
  const { store } = setupMockLocalStorage();

  store.set(STORAGE_KEYS.REVISION_COUNTER, "3");
  const next = bumpStorageRevision();

  assert.strictEqual(next, 4);
  assert.strictEqual(store.get(STORAGE_KEYS.REVISION_COUNTER), "4");
  assert.ok(store.get(STORAGE_KEYS.LAST_MODIFIED));
});
