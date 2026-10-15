import test from "node:test";
import assert from "node:assert";
import {
  isCodeforcesSuccessResponse,
  processCodeforcesSubmissions,
  type CodeforcesSubmission,
} from "../src/lib/codeforces.ts";

test("codeforces - rejects non-OK response payloads", () => {
  assert.strictEqual(isCodeforcesSuccessResponse(null), false);
  assert.strictEqual(isCodeforcesSuccessResponse({}), false);
  assert.strictEqual(
    isCodeforcesSuccessResponse({ status: "FAILED", comment: "User not found" }),
    false
  );
  assert.strictEqual(
    isCodeforcesSuccessResponse({ status: "FAILED", comment: "Call limit exceeded" }),
    false
  );
  assert.strictEqual(
    isCodeforcesSuccessResponse({ status: "OK", result: "not-an-array" }),
    false
  );
  assert.strictEqual(
    isCodeforcesSuccessResponse({ status: "OK", result: [] }),
    true
  );
});

test("codeforces - deduplicates multiple accepted submissions of the same problem", () => {
  const submissions: CodeforcesSubmission[] = [
    {
      id: 1,
      contestId: 1000,
      verdict: "OK",
      problem: { contestId: 1000, index: "A", name: "Watermelon", rating: 800 },
      creationTimeSeconds: 1600000000,
    },
    {
      id: 2,
      contestId: 1000,
      verdict: "OK",
      problem: { contestId: 1000, index: "A", name: "Watermelon", rating: 800 },
      creationTimeSeconds: 1600000100,
    },
    {
      id: 3,
      contestId: 1000,
      verdict: "WRONG_ANSWER",
      problem: { contestId: 1000, index: "B", name: "Theatre Square", rating: 1000 },
      creationTimeSeconds: 1600000200,
    },
  ];

  const { stats } = processCodeforcesSubmissions(submissions);
  // Only 1 problem solved (Watermelon once, Theatre Square had WRONG_ANSWER)
  assert.strictEqual(stats.totalSolved, 1);
  assert.strictEqual(stats.easySolved, 1);
  assert.strictEqual(stats.mediumSolved, 0);
  assert.strictEqual(stats.hardSolved, 0);
  assert.strictEqual(stats.recentSubmissions.length, 1);
  assert.strictEqual(stats.recentSubmissions[0].title, "Watermelon");
  assert.strictEqual(stats.recentSubmissions[0].difficulty, "Easy");
});

test("codeforces - correctly classifies Easy, Medium, and Hard problem ratings", () => {
  const submissions: CodeforcesSubmission[] = [
    {
      id: 10,
      contestId: 100,
      verdict: "OK",
      problem: { contestId: 100, index: "A", name: "Easy Task", rating: 1100 },
    },
    {
      id: 11,
      contestId: 100,
      verdict: "OK",
      problem: { contestId: 100, index: "B", name: "Med Task 1", rating: 1200 },
    },
    {
      id: 12,
      contestId: 100,
      verdict: "OK",
      problem: { contestId: 100, index: "C", name: "Med Task 2", rating: 1800 },
    },
    {
      id: 13,
      contestId: 100,
      verdict: "OK",
      problem: { contestId: 100, index: "D", name: "Hard Task", rating: 1900 },
    },
  ];

  const { stats } = processCodeforcesSubmissions(submissions);
  assert.strictEqual(stats.totalSolved, 4);
  assert.strictEqual(stats.easySolved, 1); // 1100 < 1200
  assert.strictEqual(stats.mediumSolved, 2); // 1200 and 1800
  assert.strictEqual(stats.hardSolved, 1); // 1900 > 1800
});

test("codeforces - preserves deduplication state across paginated batches", () => {
  const batch1: CodeforcesSubmission[] = [
    {
      id: 101,
      contestId: 200,
      verdict: "OK",
      problem: { contestId: 200, index: "A", name: "Problem A", rating: 900 },
    },
  ];

  const batch2: CodeforcesSubmission[] = [
    {
      id: 102,
      contestId: 200,
      verdict: "OK",
      problem: { contestId: 200, index: "A", name: "Problem A", rating: 900 }, // duplicate of batch1
    },
    {
      id: 103,
      contestId: 200,
      verdict: "OK",
      problem: { contestId: 200, index: "B", name: "Problem B", rating: 1400 },
    },
  ];

  const solvedSet = new Set<string>();
  const counts = { easy: 0, medium: 0, hard: 0 };
  const recentSubs: Array<{
    title: string;
    difficulty: string;
    timestamp: number;
    url: string;
  }> = [];

  // Process batch 1
  processCodeforcesSubmissions(batch1, solvedSet, recentSubs, counts);
  assert.strictEqual(solvedSet.size, 1);

  // Process batch 2 with same accumulated state
  const result = processCodeforcesSubmissions(batch2, solvedSet, recentSubs, counts);
  // Total distinct should be 2 (Problem A deduplicated across batches, Problem B added)
  assert.strictEqual(result.stats.totalSolved, 2);
  assert.strictEqual(result.stats.easySolved, 1);
  assert.strictEqual(result.stats.mediumSolved, 1);
});
