import test from "node:test";
import assert from "node:assert";
import {
  computeCodingAnalytics,
  normalizePlatform,
  normalizeDifficulty,
} from "../src/lib/storage/analytics.ts";
import type { CodingLog } from "../src/types/index.ts";

test("analytics - normalizes platform identifiers and aliases", () => {
  assert.strictEqual(normalizePlatform("leetcode"), "LeetCode");
  assert.strictEqual(normalizePlatform("LeetCode"), "LeetCode");
  assert.strictEqual(normalizePlatform("LEETCODE"), "LeetCode");
  assert.strictEqual(normalizePlatform("codeforces"), "Codeforces");
  assert.strictEqual(normalizePlatform("Codeforces"), "Codeforces");
  assert.strictEqual(normalizePlatform("cf"), "Codeforces");
  assert.strictEqual(normalizePlatform("CF"), "Codeforces");
  assert.strictEqual(normalizePlatform("gfg"), "GFG");
  assert.strictEqual(normalizePlatform("geeksforgeeks"), "GFG");
  assert.strictEqual(normalizePlatform("atcoder"), "AtCoder");
  assert.strictEqual(normalizePlatform("codechef"), "CodeChef");
  assert.strictEqual(normalizePlatform("hackerrank"), "HackerRank");
  assert.strictEqual(normalizePlatform("Custom"), "Custom");
  assert.strictEqual(normalizePlatform(""), "Other");
  assert.strictEqual(normalizePlatform(null), "Other");
  assert.strictEqual(normalizePlatform(undefined), "Other");
});

test("analytics - classifies Easy, Medium, and Hard and rejects unknown difficulties", () => {
  assert.strictEqual(normalizeDifficulty("Easy"), "Easy");
  assert.strictEqual(normalizeDifficulty("easy"), "Easy");
  assert.strictEqual(normalizeDifficulty("EASY"), "Easy");
  assert.strictEqual(normalizeDifficulty("Medium"), "Medium");
  assert.strictEqual(normalizeDifficulty("medium"), "Medium");
  assert.strictEqual(normalizeDifficulty("med"), "Medium");
  assert.strictEqual(normalizeDifficulty("Hard"), "Hard");
  assert.strictEqual(normalizeDifficulty("hard"), "Hard");

  // Missing or unknown difficulties must return null, never silently defaulting
  assert.strictEqual(normalizeDifficulty(""), null);
  assert.strictEqual(normalizeDifficulty("unknown"), null);
  assert.strictEqual(normalizeDifficulty("Expert"), null);
  assert.strictEqual(normalizeDifficulty("1800"), null);
  assert.strictEqual(normalizeDifficulty(null), null);
  assert.strictEqual(normalizeDifficulty(undefined), null);
});

test("analytics - empty dataset produces zero counts and safe defaults", () => {
  const result = computeCodingAnalytics([]);
  assert.strictEqual(result.total_solved, 0);
  assert.strictEqual(result.unclassified_count, 0);
  assert.strictEqual(result.platform_breakdown.length, 0);

  const easy = result.difficulty_breakdown.find((d) => d.difficulty === "Easy");
  const med = result.difficulty_breakdown.find((d) => d.difficulty === "Medium");
  const hard = result.difficulty_breakdown.find((d) => d.difficulty === "Hard");
  assert.strictEqual(easy?.count, 0);
  assert.strictEqual(med?.count, 0);
  assert.strictEqual(hard?.count, 0);

  // Fallback for null/malformed argument
  const nullResult = computeCodingAnalytics(null as unknown as CodingLog[]);
  assert.strictEqual(nullResult.total_solved, 0);
});

test("analytics - aggregates valid LeetCode and Codeforces records", () => {
  const logs: CodingLog[] = [
    {
      id: 1,
      problem_title: "Two Sum",
      platform: "LeetCode",
      difficulty: "Easy",
      topic_tag: "Array",
      solved_at: "2026-10-10",
      created_at: "2026-10-10T10:00:00Z",
    },
    {
      id: 2,
      problem_title: "Add Two Numbers",
      platform: "leetcode",
      difficulty: "Medium",
      topic_tag: "Linked List",
      solved_at: "2026-10-11",
      created_at: "2026-10-11T10:00:00Z",
    },
    {
      id: 3,
      problem_title: "Median of Two Sorted Arrays",
      platform: "LeetCode",
      difficulty: "Hard",
      topic_tag: "Binary Search",
      solved_at: "2026-10-12",
      created_at: "2026-10-12T10:00:00Z",
    },
    {
      id: 4,
      problem_title: "Watermelon",
      platform: "Codeforces",
      difficulty: "Easy",
      topic_tag: "Math",
      solved_at: "2026-10-13",
      created_at: "2026-10-13T10:00:00Z",
    },
    {
      id: 5,
      problem_title: "Theatre Square",
      platform: "CF",
      difficulty: "Medium",
      topic_tag: "Math",
      solved_at: "2026-10-14",
      created_at: "2026-10-14T10:00:00Z",
    },
  ];

  const analytics = computeCodingAnalytics(logs);
  assert.strictEqual(analytics.total_solved, 5);
  assert.strictEqual(analytics.unclassified_count, 0);

  const lc = analytics.platform_breakdown.find((p) => p.platform === "LeetCode");
  const cf = analytics.platform_breakdown.find((p) => p.platform === "Codeforces");
  assert.strictEqual(lc?.count, 3);
  assert.strictEqual(cf?.count, 2);

  const easy = analytics.difficulty_breakdown.find((d) => d.difficulty === "Easy");
  const med = analytics.difficulty_breakdown.find((d) => d.difficulty === "Medium");
  const hard = analytics.difficulty_breakdown.find((d) => d.difficulty === "Hard");
  assert.strictEqual(easy?.count, 2);
  assert.strictEqual(med?.count, 2);
  assert.strictEqual(hard?.count, 1);
});

test("analytics - handles missing and unknown difficulty as unclassified without defaulting to Medium", () => {
  const logs: CodingLog[] = [
    {
      id: 1,
      problem_title: "Unrated CF Problem",
      platform: "Codeforces",
      difficulty: "Unrated",
      topic_tag: "Ad-hoc",
      solved_at: "2026-10-10",
      created_at: "2026-10-10T10:00:00Z",
    },
    {
      id: 2,
      problem_title: "Custom Problem without difficulty",
      platform: "Custom",
      difficulty: "",
      topic_tag: "DSA",
      solved_at: "2026-10-11",
      created_at: "2026-10-11T10:00:00Z",
    },
    {
      id: 3,
      problem_title: "Known Easy",
      platform: "LeetCode",
      difficulty: "Easy",
      topic_tag: "DSA",
      solved_at: "2026-10-12",
      created_at: "2026-10-12T10:00:00Z",
    },
  ];

  const analytics = computeCodingAnalytics(logs);
  assert.strictEqual(analytics.total_solved, 3);
  assert.strictEqual(analytics.unclassified_count, 2);

  const easy = analytics.difficulty_breakdown.find((d) => d.difficulty === "Easy");
  const med = analytics.difficulty_breakdown.find((d) => d.difficulty === "Medium");
  const hard = analytics.difficulty_breakdown.find((d) => d.difficulty === "Hard");

  assert.strictEqual(easy?.count, 1);
  assert.strictEqual(med?.count, 0); // NOT defaulted to Medium
  assert.strictEqual(hard?.count, 0);
});

test("analytics - deduplicates records by stable ID and canonical platform URL without merging distinct titles", () => {
  const logs: CodingLog[] = [
    // Two records with identical ID (e.g. duplicate sync or import)
    {
      id: 101,
      problem_title: "Reverse Linked List",
      platform: "LeetCode",
      difficulty: "Easy",
      topic_tag: "Linked List",
      problem_url: "https://leetcode.com/problems/reverse-linked-list/",
      solved_at: "2026-10-10",
      created_at: "2026-10-10T10:00:00Z",
    },
    {
      id: 101,
      problem_title: "Reverse Linked List (copy)",
      platform: "LeetCode",
      difficulty: "Easy",
      topic_tag: "Linked List",
      problem_url: "https://leetcode.com/problems/reverse-linked-list/",
      solved_at: "2026-10-10",
      created_at: "2026-10-10T10:00:00Z",
    },
    // Another record with different ID but same canonical URL on LeetCode
    {
      id: 102,
      problem_title: "Reverse Linked List",
      platform: "leetcode",
      difficulty: "Easy",
      topic_tag: "Linked List",
      problem_url: "https://leetcode.com/problems/reverse-linked-list",
      solved_at: "2026-10-10",
      created_at: "2026-10-10T10:00:00Z",
    },
    // Distinct problem that happens to have the same title on another platform / distinct URL
    {
      id: 103,
      problem_title: "Reverse Linked List",
      platform: "GFG",
      difficulty: "Medium",
      topic_tag: "Linked List",
      problem_url: "https://practice.geeksforgeeks.org/problems/reverse-linked-list",
      solved_at: "2026-10-11",
      created_at: "2026-10-11T10:00:00Z",
    },
  ];

  const analytics = computeCodingAnalytics(logs);
  // Log 101 (kept), 101 (duplicate ID dropped), 102 (duplicate canonical URL dropped), 103 (kept, distinct platform & URL)
  assert.strictEqual(analytics.total_solved, 2);

  const lc = analytics.platform_breakdown.find((p) => p.platform === "LeetCode");
  const gfg = analytics.platform_breakdown.find((p) => p.platform === "GFG");
  assert.strictEqual(lc?.count, 1);
  assert.strictEqual(gfg?.count, 1);
});

test("analytics - filters malformed records safely", () => {
  const logs = [
    null,
    undefined,
    {},
    { id: 1 }, // missing problem_title
    { id: 2, problem_title: "   " }, // whitespace title
    {
      id: 3,
      problem_title: "Valid Problem",
      platform: "LeetCode",
      difficulty: "Easy",
      topic_tag: "DSA",
      solved_at: "2026-10-10",
      created_at: "2026-10-10T10:00:00Z",
    },
  ] as CodingLog[];

  const analytics = computeCodingAnalytics(logs);
  assert.strictEqual(analytics.total_solved, 1);
  assert.strictEqual(analytics.platform_breakdown[0].platform, "LeetCode");
  assert.strictEqual(analytics.platform_breakdown[0].count, 1);
});

test("analytics - calculates correct totals and verified percentage values without NaN", () => {
  const logs: CodingLog[] = [
    { id: 1, problem_title: "P1", platform: "LeetCode", difficulty: "Easy", topic_tag: "DSA", solved_at: "2026-10-10", created_at: "2026-10-10T10:00:00Z" },
    { id: 2, problem_title: "P2", platform: "LeetCode", difficulty: "Medium", topic_tag: "DSA", solved_at: "2026-10-10", created_at: "2026-10-10T10:00:00Z" },
    { id: 3, problem_title: "P3", platform: "Codeforces", difficulty: "Medium", topic_tag: "DSA", solved_at: "2026-10-10", created_at: "2026-10-10T10:00:00Z" },
    { id: 4, problem_title: "P4", platform: "Codeforces", difficulty: "Hard", topic_tag: "DSA", solved_at: "2026-10-10", created_at: "2026-10-10T10:00:00Z" },
  ];

  const analytics = computeCodingAnalytics(logs);
  assert.strictEqual(analytics.total_solved, 4);

  // Platform percentages out of total (4)
  const lcCount = analytics.platform_breakdown.find((p) => p.platform === "LeetCode")?.count || 0;
  const cfCount = analytics.platform_breakdown.find((p) => p.platform === "Codeforces")?.count || 0;
  const lcPct = Math.round((lcCount / analytics.total_solved) * 100);
  const cfPct = Math.round((cfCount / analytics.total_solved) * 100);

  assert.strictEqual(lcPct, 50);
  assert.strictEqual(cfPct, 50);
  assert(!isNaN(lcPct) && !isNaN(cfPct));

  // Difficulty percentages out of classified (4)
  const easyCount = analytics.difficulty_breakdown.find((d) => d.difficulty === "Easy")?.count || 0;
  const medCount = analytics.difficulty_breakdown.find((d) => d.difficulty === "Medium")?.count || 0;
  const hardCount = analytics.difficulty_breakdown.find((d) => d.difficulty === "Hard")?.count || 0;
  const classifiedSum = easyCount + medCount + hardCount;

  const easyPct = Math.round((easyCount / classifiedSum) * 100);
  const medPct = Math.round((medCount / classifiedSum) * 100);
  const hardPct = Math.round((hardCount / classifiedSum) * 100);

  assert.strictEqual(easyPct, 25);
  assert.strictEqual(medPct, 50);
  assert.strictEqual(hardPct, 25);
  assert(!isNaN(easyPct) && !isNaN(medPct) && !isNaN(hardPct));
});

test("analytics - updates incrementally after appending newly synced records", () => {
  const initialLogs: CodingLog[] = [
    { id: 1, problem_title: "Manual 1", platform: "LeetCode", difficulty: "Easy", topic_tag: "DSA", solved_at: "2026-10-10", created_at: "2026-10-10T10:00:00Z" },
  ];

  const step1 = computeCodingAnalytics(initialLogs);
  assert.strictEqual(step1.total_solved, 1);
  assert.strictEqual(step1.platform_breakdown[0].count, 1);

  // Synced batches arrive from Codeforces
  const syncedBatch: CodingLog[] = [
    { id: 2, problem_title: "CF 1", platform: "Codeforces", difficulty: "Medium", topic_tag: "CF Sync", solved_at: "2026-10-11", created_at: "2026-10-11T10:00:00Z" },
    { id: 3, problem_title: "CF 2", platform: "Codeforces", difficulty: "Hard", topic_tag: "CF Sync", solved_at: "2026-10-12", created_at: "2026-10-12T10:00:00Z" },
  ];

  const combined = [...syncedBatch, ...initialLogs];
  const step2 = computeCodingAnalytics(combined);
  assert.strictEqual(step2.total_solved, 3);
  assert.strictEqual(step2.platform_breakdown.find((p) => p.platform === "LeetCode")?.count, 1);
  assert.strictEqual(step2.platform_breakdown.find((p) => p.platform === "Codeforces")?.count, 2);
});

test("analytics - maintains clear separation between coding problem ledger and timetable routines", () => {
  // Solved problem records in arena
  const manualLog: CodingLog = {
    id: 1,
    problem_title: "Course Schedule",
    platform: "LeetCode",
    difficulty: "Medium",
    topic_tag: "Graph",
    solved_at: "2026-10-10",
    created_at: "2026-10-10T10:00:00Z",
  };

  const syncedLog: CodingLog = {
    id: 2,
    problem_title: "Watermelon",
    platform: "Codeforces",
    difficulty: "Easy",
    topic_tag: "Codeforces Sync",
    solved_at: "2026-10-10",
    created_at: "2026-10-10T10:00:00Z",
  };

  // Routine timetable items (daily time blocks)
  const timetableRoutine = {
    id: 99,
    title: "Morning DSA Practice",
    start_time: "08:00",
    end_time: "09:30",
    category: "Coding",
    is_completed_today: true,
  };

  // Only CodingLog items belong in coding analytics
  const analytics = computeCodingAnalytics([manualLog, syncedLog]);
  assert.strictEqual(analytics.total_solved, 2);
  assert.strictEqual(analytics.platform_breakdown.find((p) => p.platform === "LeetCode")?.count, 1);
  assert.strictEqual(analytics.platform_breakdown.find((p) => p.platform === "Codeforces")?.count, 1);

  // Timetable routines are separate domain entities and do not pollute the difficulty breakdown
  assert.strictEqual(
    analytics.difficulty_breakdown.reduce((acc, curr) => acc + curr.count, 0),
    2
  );
  assert.strictEqual(
    analytics.platform_breakdown.some((p) => p.platform === timetableRoutine.category),
    false
  );
});
