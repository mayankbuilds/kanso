export interface CodeforcesProblem {
  contestId?: number;
  index?: string;
  name?: string;
  rating?: number;
  tags?: string[];
}

export interface CodeforcesSubmission {
  id: number;
  contestId?: number;
  creationTimeSeconds?: number;
  relativeTimeSeconds?: number;
  problem?: CodeforcesProblem;
  verdict?: string;
  testset?: string;
  passedTestCount?: number;
  timeConsumedMillis?: number;
  memoryConsumedBytes?: number;
}

export interface ProcessedCodeforcesStats {
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  recentSubmissions: Array<{
    title: string;
    difficulty: string;
    timestamp: number;
    url: string;
  }>;
}

/**
 * Validates whether an upstream Codeforces response payload is valid and OK.
 */
export function isCodeforcesSuccessResponse(payload: unknown): payload is {
  status: "OK";
  result: CodeforcesSubmission[];
} {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as { status?: string; result?: unknown };
  return p.status === "OK" && Array.isArray(p.result);
}

/**
 * Processes a batch of Codeforces submissions, deduplicating accepted problems,
 * categorizing difficulty, and collecting recent distinct solved problems.
 */
export function processCodeforcesSubmissions(
  submissions: CodeforcesSubmission[],
  solvedSet: Set<string> = new Set<string>(),
  recentSubs: Array<{
    title: string;
    difficulty: string;
    timestamp: number;
    url: string;
  }> = [],
  counts: { easy: number; medium: number; hard: number } = {
    easy: 0,
    medium: 0,
    hard: 0,
  }
): {
  stats: ProcessedCodeforcesStats;
  solvedSet: Set<string>;
  counts: { easy: number; medium: number; hard: number };
} {
  for (const sub of submissions) {
    if (sub.verdict === "OK" && sub.problem) {
      const p = sub.problem;
      const key =
        p.contestId !== undefined && p.index
          ? `${p.contestId}-${p.index}`
          : (p.name || "");

      if (key && !solvedSet.has(key)) {
        solvedSet.add(key);

        const probRating = p.rating || 1200;
        let diff = "Medium";
        if (probRating < 1200) {
          diff = "Easy";
          counts.easy++;
        } else if (probRating <= 1800) {
          diff = "Medium";
          counts.medium++;
        } else {
          diff = "Hard";
          counts.hard++;
        }

        if (recentSubs.length < 15) {
          const contestId = p.contestId;
          const index = p.index;
          const problemUrl =
            contestId && index
              ? `https://codeforces.com/problemset/problem/${contestId}/${index}`
              : `https://codeforces.com/problemset`;

          recentSubs.push({
            title: p.name || key,
            difficulty: diff,
            timestamp: sub.creationTimeSeconds || 0,
            url: problemUrl,
          });
        }
      }
    }
  }

  return {
    stats: {
      totalSolved: solvedSet.size,
      easySolved: counts.easy,
      mediumSolved: counts.medium,
      hardSolved: counts.hard,
      recentSubmissions: recentSubs,
    },
    solvedSet,
    counts,
  };
}
