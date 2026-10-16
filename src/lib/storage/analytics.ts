import type {
  CodingLog,
  CodingAnalytics,
  PlatformStat,
  DifficultyStat,
} from "../../types/index.ts";

/**
 * Normalizes platform strings and aliases into canonical platform labels.
 */
export function normalizePlatform(raw?: string | null): string {
  if (!raw || typeof raw !== "string") return "Other";
  const trimmed = raw.trim();
  if (!trimmed) return "Other";

  const lower = trimmed.toLowerCase();
  if (lower === "leetcode") return "LeetCode";
  if (lower === "codeforces" || lower === "cf") return "Codeforces";
  if (lower === "codechef") return "CodeChef";
  if (lower === "hackerrank") return "HackerRank";
  if (lower === "atcoder") return "AtCoder";
  if (lower === "gfg" || lower === "geeksforgeeks") return "GFG";

  return trimmed;
}

/**
 * Validates and normalizes difficulty values.
 * Returns 'Easy' | 'Medium' | 'Hard' only when valid; otherwise returns null (unclassified).
 * Missing or unknown difficulties are NEVER silently defaulted to a tier.
 */
export function normalizeDifficulty(
  raw?: string | null
): "Easy" | "Medium" | "Hard" | null {
  if (!raw || typeof raw !== "string") return null;
  const lower = raw.trim().toLowerCase();
  if (lower === "easy") return "Easy";
  if (lower === "medium" || lower === "med") return "Medium";
  if (lower === "hard") return "Hard";
  return null;
}

/**
 * Normalizes a URL for canonical identity comparison.
 */
function normalizeUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, "");
}

/**
 * Computes coding analytics from the ledger of problem logs.
 *
 * Rules:
 * 1. Safely deduplicates records by stable ID and canonical platform URL.
 * 2. Does NOT merge distinct problems based on title alone.
 * 3. Classifies Easy, Medium, and Hard only when known and valid.
 * 4. Tracks unclassified problems separately.
 * 5. Guarantees deterministic, non-NaN calculations even on empty or malformed datasets.
 */
export function computeCodingAnalytics(logs: CodingLog[]): CodingAnalytics {
  if (!Array.isArray(logs) || logs.length === 0) {
    return {
      total_solved: 0,
      platform_breakdown: [],
      difficulty_breakdown: [
        { difficulty: "Easy", count: 0, color: "#10b981" },
        { difficulty: "Medium", count: 0, color: "#f59e0b" },
        { difficulty: "Hard", count: 0, color: "#ef4444" },
      ],
      unclassified_count: 0,
    };
  }

  const seenIds = new Set<string | number>();
  const seenUrls = new Set<string>();
  const deduplicated: CodingLog[] = [];

  for (const log of logs) {
    if (!log || typeof log !== "object") continue;
    if (typeof log.problem_title !== "string" || !log.problem_title.trim()) {
      continue;
    }

    // 1. Deduplicate by stable ID if present
    if (log.id !== undefined && log.id !== null) {
      if (seenIds.has(log.id)) {
        continue;
      }
      seenIds.add(log.id);
    }

    // 2. Deduplicate by canonical platform URL if present
    if (log.problem_url && typeof log.problem_url === "string" && log.problem_url.trim()) {
      const normPlat = normalizePlatform(log.platform).toLowerCase();
      const normUrl = normalizeUrl(log.problem_url);
      const urlKey = `${normPlat}::${normUrl}`;
      if (seenUrls.has(urlKey)) {
        continue;
      }
      seenUrls.add(urlKey);
    }

    deduplicated.push(log);
  }

  const total_solved = deduplicated.length;
  const platMap: Record<string, number> = {};
  const diffMap: Record<"Easy" | "Medium" | "Hard", number> = {
    Easy: 0,
    Medium: 0,
    Hard: 0,
  };

  for (const item of deduplicated) {
    const platform = normalizePlatform(item.platform);
    platMap[platform] = (platMap[platform] || 0) + 1;

    const diff = normalizeDifficulty(item.difficulty);
    if (diff) {
      diffMap[diff]++;
    }
  }

  const classifiedCount = diffMap.Easy + diffMap.Medium + diffMap.Hard;
  const unclassified_count = Math.max(0, total_solved - classifiedCount);

  // Platform styling lookup
  const getPlatformColor = (p: string): string => {
    switch (p) {
      case "LeetCode":
        return "#f59e0b";
      case "Codeforces":
        return "#3b82f6";
      case "GFG":
        return "#10b981";
      case "CodeChef":
        return "#8b5cf6";
      case "AtCoder":
        return "#6366f1";
      case "HackerRank":
        return "#06b6d4";
      default:
        return "#71717a";
    }
  };

  // Sort: LeetCode and Codeforces first, then by count descending
  const platform_breakdown: PlatformStat[] = Object.entries(platMap)
    .map(([platform, count]) => ({
      platform,
      count,
      color: getPlatformColor(platform),
    }))
    .sort((a, b) => {
      if (a.platform === "LeetCode") return -1;
      if (b.platform === "LeetCode") return 1;
      if (a.platform === "Codeforces") return -1;
      if (b.platform === "Codeforces") return 1;
      return b.count - a.count;
    });

  const difficulty_breakdown: DifficultyStat[] = [
    { difficulty: "Easy", count: diffMap.Easy, color: "#10b981" },
    { difficulty: "Medium", count: diffMap.Medium, color: "#f59e0b" },
    { difficulty: "Hard", count: diffMap.Hard, color: "#ef4444" },
  ];

  return {
    total_solved,
    platform_breakdown,
    difficulty_breakdown,
    unclassified_count,
  };
}
