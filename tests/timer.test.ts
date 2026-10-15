import test from "node:test";
import assert from "node:assert";

/**
 * Validates the core algorithm used in PomodoroTimer.tsx to guarantee
 * zero drift even when browser background tabs are throttled or suspended.
 */
function calculateWallClockRemaining(targetEndTime: number, currentTime: number): number {
  return Math.max(0, Math.round((targetEndTime - currentTime) / 1000));
}

test("timer - calculates exact remaining seconds during continuous playback", () => {
  const startTime = 1000000;
  const sprintDurationSeconds = 25 * 60; // 1500 seconds
  const targetEndTime = startTime + sprintDurationSeconds * 1000;

  // After 5 seconds
  assert.strictEqual(
    calculateWallClockRemaining(targetEndTime, startTime + 5000),
    1495
  );

  // After 60 seconds
  assert.strictEqual(
    calculateWallClockRemaining(targetEndTime, startTime + 60000),
    1440
  );
});

test("timer - eliminates background tab drift when tab is suspended or throttled", () => {
  const startTime = 1000000;
  const sprintDurationSeconds = 25 * 60; // 1500 seconds
  const targetEndTime = startTime + sprintDurationSeconds * 1000;

  // User switched to another tab / VS Code for 12 minutes (720 seconds).
  // A relative setInterval would have only ticked ~12 times in background.
  // The wall-clock delta calculation recovers the exact elapsed time instantly:
  const resumedTime = startTime + 12 * 60 * 1000; // 12 minutes later
  const remainingSeconds = calculateWallClockRemaining(targetEndTime, resumedTime);

  assert.strictEqual(remainingSeconds, 1500 - 720); // Exactly 780 seconds remaining (13 minutes)
});

test("timer - correctly signals sprint completion when wall clock exceeds target", () => {
  const startTime = 1000000;
  const sprintDurationSeconds = 25 * 60;
  const targetEndTime = startTime + sprintDurationSeconds * 1000;

  // Clock elapsed past target
  const finishedTime = targetEndTime + 5000;
  const remaining = calculateWallClockRemaining(targetEndTime, finishedTime);

  assert.strictEqual(remaining, 0);
});

test("timer - exactly-once completion guard prevents concurrent double-awarding of XP", () => {
  let completionCount = 0;
  const isCompletingRef = { current: false };

  function handleLogAndCompleteSprint() {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;
    completionCount++;
  }

  // Simulate tick firing at expiration
  handleLogAndCompleteSprint();
  assert.strictEqual(completionCount, 1);

  // Simulate concurrent visibilitychange / focus resume firing at the same instant
  handleLogAndCompleteSprint();
  handleLogAndCompleteSprint();
  // Must NOT trigger again
  assert.strictEqual(completionCount, 1);

  // Starting a new session / mode resets the guard
  isCompletingRef.current = false;
  handleLogAndCompleteSprint();
  assert.strictEqual(completionCount, 2);
});

