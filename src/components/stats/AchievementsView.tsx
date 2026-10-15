"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import confetti from "canvas-confetti";
import {
  Award,
  Flame,
  Shield,
  Sparkles,
  Trophy,
  Zap,
  BarChart2,
  Clock,
  Code2,
  RefreshCw,
  CheckCircle2,
  X,
  Target,
  Moon,
  Crown,
  Search,
} from "lucide-react";
import {
  UserStats,
  FocusStats,
  CodingAnalytics,
  CodingSyncResult,
} from "@/types";
import { api } from "@/lib/api";
import { STORAGE_KEYS, getLocal, setLocal } from "@/lib/storage";

interface Props {
  stats: UserStats | null;
  totalSolved: number;
  onRefreshDashboard?: () => Promise<void>;
}

export interface BadgeItem {
  id: string;
  title: string;
  desc: string;
  lore: string;
  unlocked: boolean;
  icon: React.ComponentType<{ className?: string }>;
  tier: "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond" | "Mythic";
  category: "DSA" | "Streak" | "Focus" | "Special";
}

export default function AchievementsView({
  stats,
  totalSolved,
  onRefreshDashboard,
}: Props) {
  const level = stats?.level ?? 1;
  const xp = stats?.xp ?? 0;
  const streak = stats?.current_streak_days ?? 0;
  const currentLevelProgress = xp % 300;

  // Analytics & Stats State
  const [focusStats, setFocusStats] = useState<FocusStats | null>(null);
  const [codingAnalytics, setCodingAnalytics] =
    useState<CodingAnalytics | null>(null);
  const [, setLoadingAnalytics] = useState(true);

  // LeetCode Sync State
  const [lcUsername, setLcUsername] = useState("");
  const [syncingLc, setSyncingLc] = useState(false);
  const [lcResult, setLcResult] = useState<CodingSyncResult | null>(null);
  const [lcError, setLcError] = useState<string | null>(null);

  // Codeforces Sync State
  const [cfHandle, setCfHandle] = useState("");
  const [syncingCf, setSyncingCf] = useState(false);
  const [cfResult, setCfResult] = useState<CodingSyncResult | null>(null);
  const [cfError, setCfError] = useState<string | null>(null);

  // Breakdown View Mode: "logged" (Arena Logs) vs "profiles" (Live Profiles)
  const [breakdownView, setBreakdownView] = useState<"logged" | "profiles">(
    "logged",
  );

  // Badge Celebration Modal State
  const [celebratingBadge, setCelebratingBadge] = useState<BadgeItem | null>(
    null,
  );

  // All Badges Explorer Modal State
  const [showAllBadgesModal, setShowAllBadgesModal] = useState(false);
  const [badgeCategoryFilter, setBadgeCategoryFilter] = useState<string>("All");
  const [badgeSearchQuery, setBadgeSearchQuery] = useState("");
  const [badgeStatusFilter, setBadgeStatusFilter] = useState<
    "all" | "unlocked" | "locked"
  >("all");
  const [cachedTodayMins, setCachedTodayMins] = useState(0);
  const [localTotalCompleted, setLocalTotalCompleted] = useState(0);

  const loadStatsData = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const [f, c] = await Promise.all([
        api.getFocusStats(7),
        api.getCodingAnalytics(),
      ]);
      setFocusStats(f);
      setCodingAnalytics(c);
    } catch (err) {
      console.error("Failed to load stats analytics:", err);
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  // Load saved handles, fetch stats on mount, and trigger background auto-sync
  useEffect(() => {
    let savedLc = "";
    let savedCf = "";
    if (typeof window !== "undefined") {
      const savedLcRes = getLocal<CodingSyncResult | null>(STORAGE_KEYS.LC_RESULT, null);
      if (savedLcRes) setLcResult(savedLcRes);

      const savedCfRes = getLocal<CodingSyncResult | null>(STORAGE_KEYS.CF_RESULT, null);
      if (savedCfRes) setCfResult(savedCfRes);

      const rawTotal = getLocal<string | number>(STORAGE_KEYS.FOCUS_TOTAL_COMPLETED_MINS, "0");
      const totalMins = typeof rawTotal === "number" ? rawTotal : parseInt(rawTotal || "0", 10);
      setLocalTotalCompleted(isNaN(totalMins) ? 0 : totalMins);

      savedLc = getLocal<string>(STORAGE_KEYS.LC_HANDLE, "");
      savedCf = getLocal<string>(STORAGE_KEYS.CF_HANDLE, "");
      if (savedLc) setLcUsername(savedLc);
      if (savedCf) setCfHandle(savedCf);

      const todayStr = new Date().toISOString().slice(0, 10);
      const rawToday =
        localStorage.getItem(`${STORAGE_KEYS.FOCUS_TODAY_PREFIX}${todayStr}`) ||
        localStorage.getItem(`streakflow_focus_mins_${todayStr}`) ||
        "0";
      const val = parseInt(rawToday, 10);
      setCachedTodayMins(isNaN(val) ? 0 : val);
    }

    loadStatsData().then(() => {
      // Auto-sync in background if handles exist
      if (savedLc) {
        setSyncingLc(true);
        api
          .syncLeetCode(savedLc)
          .then((res) => {
            setLcResult(res);
            if (typeof window !== "undefined") {
              setLocal(STORAGE_KEYS.LC_RESULT, res);
            }
            loadStatsData();
          })
          .catch((err) => {
            console.warn("Background LeetCode auto-sync:", err);
          })
          .finally(() => setSyncingLc(false));
      }
      if (savedCf) {
        setSyncingCf(true);
        api
          .syncCodeforces(savedCf)
          .then((res) => {
            setCfResult(res);
            if (typeof window !== "undefined") {
              setLocal(STORAGE_KEYS.CF_RESULT, res);
            }
            loadStatsData();
          })
          .catch((err) => {
            console.warn("Background Codeforces auto-sync:", err);
          })
          .finally(() => setSyncingCf(false));
      }
    });

    const handleFocusCompleted = () => {
      loadStatsData();
      if (typeof window !== "undefined") {
        const todayStr = new Date().toISOString().slice(0, 10);
        const rawToday =
          localStorage.getItem(`${STORAGE_KEYS.FOCUS_TODAY_PREFIX}${todayStr}`) ||
          localStorage.getItem(`streakflow_focus_mins_${todayStr}`) ||
          "0";
        const val = parseInt(rawToday, 10);
        setCachedTodayMins(isNaN(val) ? 0 : val);

        const rawTotal = getLocal<string | number>(STORAGE_KEYS.FOCUS_TOTAL_COMPLETED_MINS, "0");
        const totalMins = typeof rawTotal === "number" ? rawTotal : parseInt(rawTotal || "0", 10);
        setLocalTotalCompleted(isNaN(totalMins) ? 0 : totalMins);
      }
    };

    const handleDataReset = () => {
      setCachedTodayMins(0);
      setLocalTotalCompleted(0);
      setFocusStats({
        total_focus_minutes: 0,
        today_focus_minutes: 0,
        total_sessions: 0,
        daily_stats: [],
      });
      loadStatsData();
    };

    const handleHandlesUpdated = (e: Event) => {
      const custom = e as CustomEvent<{ lcHandle?: string; cfHandle?: string }>;
      const nextLc =
        custom.detail?.lcHandle !== undefined
          ? custom.detail.lcHandle
          : typeof window !== "undefined"
            ? getLocal<string>(STORAGE_KEYS.LC_HANDLE, "")
            : "";
      const nextCf =
        custom.detail?.cfHandle !== undefined
          ? custom.detail.cfHandle
          : typeof window !== "undefined"
            ? getLocal<string>(STORAGE_KEYS.CF_HANDLE, "")
            : "";

      if (nextLc !== undefined) setLcUsername(nextLc);
      if (nextCf !== undefined) setCfHandle(nextCf);

      if (nextLc) {
        setSyncingLc(true);
        api
          .syncLeetCode(nextLc)
          .then((res) => {
            setLcResult(res);
            loadStatsData();
            if (onRefreshDashboard) onRefreshDashboard();
          })
          .catch((err) => console.warn("LeetCode auto-sync error:", err))
          .finally(() => setSyncingLc(false));
      }
      if (nextCf) {
        setSyncingCf(true);
        api
          .syncCodeforces(nextCf)
          .then((res) => {
            setCfResult(res);
            loadStatsData();
            if (onRefreshDashboard) onRefreshDashboard();
          })
          .catch((err) => console.warn("Codeforces auto-sync error:", err))
          .finally(() => setSyncingCf(false));
      }
    };

    window.addEventListener("focus-session-completed", handleFocusCompleted);
    window.addEventListener("streakflow-data-reset", handleDataReset);
    window.addEventListener("streakflow-handles-updated", handleHandlesUpdated);
    return () => {
      window.removeEventListener(
        "focus-session-completed",
        handleFocusCompleted,
      );
      window.removeEventListener("streakflow-data-reset", handleDataReset);
      window.removeEventListener(
        "streakflow-handles-updated",
        handleHandlesUpdated,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSyncLeetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lcUsername.trim()) return;
    setSyncingLc(true);
    setLcError(null);
    try {
      const res = await api.syncLeetCode(lcUsername.trim());
      setLcResult(res);
      if (typeof window !== "undefined") {
        setLocal(STORAGE_KEYS.LC_HANDLE, lcUsername.trim());
        setLocal(STORAGE_KEYS.LC_RESULT, res);
        window.dispatchEvent(
          new CustomEvent("streakflow-handles-updated", {
            detail: { lcHandle: lcUsername.trim() },
          }),
        );
      }
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
      await loadStatsData();
      if (onRefreshDashboard) await onRefreshDashboard();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to sync LeetCode";
      setLcError(msg);
    } finally {
      setSyncingLc(false);
    }
  };

  const handleSyncCodeforces = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfHandle.trim()) return;
    setSyncingCf(true);
    setCfError(null);
    try {
      const res = await api.syncCodeforces(cfHandle.trim());
      setCfResult(res);
      if (typeof window !== "undefined") {
        setLocal(STORAGE_KEYS.CF_HANDLE, cfHandle.trim());
        setLocal(STORAGE_KEYS.CF_RESULT, res);
        window.dispatchEvent(
          new CustomEvent("streakflow-handles-updated", {
            detail: { cfHandle: cfHandle.trim() },
          }),
        );
      }
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
      await loadStatsData();
      if (onRefreshDashboard) await onRefreshDashboard();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to sync Codeforces";
      setCfError(msg);
    } finally {
      setSyncingCf(false);
    }
  };

  // Victory sound effect for badge celebration
  const playCelebrationSound = () => {
    if (typeof window === "undefined") return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Festive major arpeggio: C5 (523.25) -> E5 (659.25) -> G5 (783.99) -> C6 (1046.5)
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0.25, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.4);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.4);
      });
    } catch {}
  };

  const triggerBadgeCelebration = (badge: BadgeItem) => {
    if (!badge.unlocked) return;
    setCelebratingBadge(badge);
    playCelebrationSound();
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.5 },
      colors: ["#10b981", "#3b82f6", "#a855f7", "#f59e0b"],
    });
  };

  // Expanded 15 Badges & Milestones
  const badges: BadgeItem[] = useMemo(
    () => [
      {
        id: "first_blood",
        title: "First Blood",
        desc: "Solve and record your first problem in the arena",
        lore: "Every master was once a beginner who refused to quit.",
        unlocked: totalSolved >= 1,
        icon: Zap,
        tier: "Bronze",
        category: "DSA",
      },
      {
        id: "decathlete",
        title: "Decathlete",
        desc: "Solve and record 10 coding problems",
        lore: "Building the neural pathways of algorithmic intuition.",
        unlocked: totalSolved >= 10,
        icon: Target,
        tier: "Bronze",
        category: "DSA",
      },
      {
        id: "half_century",
        title: "Half Century",
        desc: "Log 50 solved coding problems",
        lore: "Consistency compounds into unbreakable confidence.",
        unlocked: totalSolved >= 50,
        icon: Trophy,
        tier: "Silver",
        category: "DSA",
      },
      {
        id: "century",
        title: "Centurion",
        desc: "Log 100 solved problems in the ledger",
        lore: "A monumental milestone reached only through relentless execution.",
        unlocked: totalSolved >= 100,
        icon: Crown,
        tier: "Gold",
        category: "DSA",
      },
      {
        id: "grandmaster",
        title: "Grandmaster Solver",
        desc: "Accumulate 250 solved problems across platforms",
        lore: "You navigate problem spaces like a seasoned cartographer.",
        unlocked: totalSolved >= 250,
        icon: Sparkles,
        tier: "Diamond",
        category: "DSA",
      },
      {
        id: "streak_initiate",
        title: "Consistency Initiate",
        desc: "Maintain an active 3-day streak",
        lore: "Momentum is starting to take over inertia.",
        unlocked: streak >= 3,
        icon: Flame,
        tier: "Bronze",
        category: "Streak",
      },
      {
        id: "streak_warrior",
        title: "Streak Warrior",
        desc: "Maintain a 7-day consistency streak",
        lore: "One full week without skipping a single day. Iron discipline.",
        unlocked: streak >= 7,
        icon: Flame,
        tier: "Silver",
        category: "Streak",
      },
      {
        id: "unstoppable",
        title: "Unstoppable Force",
        desc: "Maintain a 30-day consistency streak",
        lore: "Habit is now instinct. You are in the top 1% of dedicated builders.",
        unlocked: streak >= 30,
        icon: Flame,
        tier: "Mythic",
        category: "Streak",
      },
      {
        id: "deep_focus_pioneer",
        title: "Deep Focus Pioneer",
        desc: "Complete your first Pomodoro deep work sprint",
        lore: "Discipline is choosing what you want most over what you want now.",
        unlocked: (focusStats?.total_sessions ?? 0) >= 1,
        icon: Clock,
        tier: "Bronze",
        category: "Focus",
      },
      {
        id: "zen_adept",
        title: "Flow State Adept",
        desc: "Complete at least 10 deep focus sprints",
        lore: "Effortless concentration during extended coding sessions.",
        unlocked: (focusStats?.total_sessions ?? 0) >= 10,
        icon: Clock,
        tier: "Silver",
        category: "Focus",
      },
      {
        id: "marathon_mindset",
        title: "Marathon Mindset",
        desc: "Complete 50 deep focus sprints (over 20+ hours)",
        lore: "Deep work has become your unfair competitive advantage.",
        unlocked: (focusStats?.total_sessions ?? 0) >= 50,
        icon: Shield,
        tier: "Platinum",
        category: "Focus",
      },
      {
        id: "level_five",
        title: "Shield Bearer",
        desc: "Reach Level 5 in execution hierarchy",
        lore: "Ascending the ranks through proven consistency and XP.",
        unlocked: level >= 5,
        icon: Shield,
        tier: "Silver",
        category: "Special",
      },
      {
        id: "level_ten",
        title: "System Sovereign",
        desc: "Reach Level 10 in execution hierarchy",
        lore: "You command routines, focus, and algorithms with master precision.",
        unlocked: level >= 10,
        icon: Award,
        tier: "Diamond",
        category: "Special",
      },
      {
        id: "dual_gladiator",
        title: "Dual Gladiator",
        desc: "Sync both LeetCode and Codeforces accounts",
        lore: "Bridging the worlds of interview prep and competitive speed.",
        unlocked: Boolean(
          lcResult ||
          (codingAnalytics?.platform_breakdown.some(
            (p) => p.platform === "LeetCode",
          ) &&
            codingAnalytics?.platform_breakdown.some(
              (p) => p.platform === "Codeforces",
            )),
        ),
        icon: Code2,
        tier: "Gold",
        category: "Special",
      },
      {
        id: "night_owl",
        title: "Night Owl Architect",
        desc: "Log a problem or focus sprint in the quiet late hours",
        lore: "When the rest of the world is asleep, you are building.",
        unlocked: totalSolved >= 3 || (focusStats?.total_sessions ?? 0) >= 3,
        icon: Moon,
        tier: "Silver",
        category: "Special",
      },
    ],
    [totalSolved, streak, focusStats, level, lcResult, codingAnalytics],
  );

  // Compute Logged Problems Breakdown (from user's timetable/arena logs)
  const loggedTotal = codingAnalytics?.total_solved ?? totalSolved;

  const loggedDifficulties = useMemo(() => {
    const rawBreakdown = codingAnalytics?.difficulty_breakdown || [];
    const easyCount =
      rawBreakdown.find((d) => d.difficulty === "Easy")?.count || 0;
    const mediumCount =
      rawBreakdown.find((d) => d.difficulty === "Medium")?.count || 0;
    const hardCount =
      rawBreakdown.find((d) => d.difficulty === "Hard")?.count || 0;
    const sum = easyCount + mediumCount + hardCount || 1;

    return [
      {
        difficulty: "Easy",
        count: easyCount,
        color: "#10b981",
        pct: easyCount > 0 ? Math.round((easyCount / sum) * 100) : 0,
      },
      {
        difficulty: "Medium",
        count: mediumCount,
        color: "#f59e0b",
        pct: mediumCount > 0 ? Math.round((mediumCount / sum) * 100) : 0,
      },
      {
        difficulty: "Hard",
        count: hardCount,
        color: "#ef4444",
        pct: hardCount > 0 ? Math.round((hardCount / sum) * 100) : 0,
      },
    ];
  }, [codingAnalytics]);

  const loggedPlatforms = useMemo(() => {
    const pb = codingAnalytics?.platform_breakdown || [];
    const lc = pb.find((p) => p.platform === "LeetCode")?.count || 0;
    const cf = pb.find((p) => p.platform === "Codeforces")?.count || 0;
    const others = pb
      .filter((p) => p.platform !== "LeetCode" && p.platform !== "Codeforces")
      .reduce((acc, curr) => acc + curr.count, 0);
    const sum = lc + cf + others || 1;

    return {
      leetcode: {
        count: lc,
        pct: lc > 0 ? Math.round((lc / sum) * 100) : 0,
      },
      codeforces: {
        count: cf,
        pct: cf > 0 ? Math.round((cf / sum) * 100) : 0,
      },
      others: {
        count: others,
        pct: others > 0 ? Math.round((others / sum) * 100) : 0,
      },
      total: lc + cf + others,
    };
  }, [codingAnalytics]);

  // Compute Connected Profiles Breakdown (direct from LeetCode & Codeforces APIs)
  const profileTotal =
    (lcResult?.total_solved || 0) + (cfResult?.total_solved || 0);

  const profileDifficulties = useMemo(() => {
    const easyCount =
      (lcResult?.easy_solved || 0) + (cfResult?.easy_solved || 0);
    const mediumCount =
      (lcResult?.medium_solved || 0) + (cfResult?.medium_solved || 0);
    const hardCount =
      (lcResult?.hard_solved || 0) + (cfResult?.hard_solved || 0);
    const sum = easyCount + mediumCount + hardCount || 1;

    return [
      {
        difficulty: "Easy",
        count: easyCount,
        color: "#10b981",
        pct: easyCount > 0 ? Math.round((easyCount / sum) * 100) : 0,
      },
      {
        difficulty: "Medium",
        count: mediumCount,
        color: "#f59e0b",
        pct: mediumCount > 0 ? Math.round((mediumCount / sum) * 100) : 0,
      },
      {
        difficulty: "Hard",
        count: hardCount,
        color: "#ef4444",
        pct: hardCount > 0 ? Math.round((hardCount / sum) * 100) : 0,
      },
    ];
  }, [lcResult, cfResult]);

  const profilePlatforms = useMemo(() => {
    const lc = lcResult?.total_solved || 0;
    const cf = cfResult?.total_solved || 0;
    const sum = lc + cf || 1;

    return {
      leetcode: {
        count: lc,
        pct: lc > 0 ? Math.round((lc / sum) * 100) : 0,
      },
      codeforces: {
        count: cf,
        pct: cf > 0 ? Math.round((cf / sum) * 100) : 0,
      },
    };
  }, [lcResult, cfResult]);

  // Maximum minutes for the 7-day bar chart
  const maxFocusMinutes = Math.max(
    ...(focusStats?.daily_stats.map((d) => d.focus_minutes) || [60]),
    60,
  );

  // Focus Minutes Computation (guaranteed accurate minutes & zero-latency today cache)
  const backendToday = focusStats?.today_focus_minutes ?? 0;
  const backendTotal = focusStats?.total_focus_minutes ?? 0;
  const displayedTodayMinutes = Math.max(backendToday, cachedTodayMins);
  const displayedTotalMinutes = Math.max(
    backendTotal,
    localTotalCompleted,
    displayedTodayMinutes,
  );

  // Filtered badges for the Full Gallery Modal
  const filteredBadges = useMemo(() => {
    return badges.filter((b) => {
      if (badgeCategoryFilter !== "All" && b.category !== badgeCategoryFilter) {
        return false;
      }
      if (badgeStatusFilter === "unlocked" && !b.unlocked) return false;
      if (badgeStatusFilter === "locked" && b.unlocked) return false;
      if (badgeSearchQuery.trim()) {
        const q = badgeSearchQuery.toLowerCase();
        return (
          b.title.toLowerCase().includes(q) ||
          b.desc.toLowerCase().includes(q) ||
          b.lore.toLowerCase().includes(q) ||
          b.tier.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [badges, badgeCategoryFilter, badgeStatusFilter, badgeSearchQuery]);

  return (
    <div className="space-y-6 font-mono">
      {/* TOP BANNER: MILESTONES & PROGRESS */}
      <div className="bg-surface-elevated border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <span className="text-xs text-accent uppercase tracking-wider flex items-center gap-1.5 font-semibold">
              <Award className="w-3.5 h-3.5" /> Milestones & Progress
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
              Level {level}
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
              {300 - currentLevelProgress} XP remaining to achieve Level{" "}
              {level + 1}
            </p>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-3xl sm:text-4xl font-bold text-accent">
              {xp}
            </span>
            <span className="text-xs text-zinc-500 block">
              Lifetime XP
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6 relative z-10">
          <div className="flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400 mb-1.5">
            <span>Progress to Next Level</span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              {Math.round((currentLevelProgress / 300) * 100)}%
            </span>
          </div>
          <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800/80 rounded-full border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${(currentLevelProgress / 300) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* QUICK METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface-elevated border border-zinc-200 dark:border-zinc-800/80 p-4 rounded-2xl">
          <span className="text-[10px] uppercase text-zinc-500 block font-semibold tracking-wider">
            Total Solved
          </span>
          <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 block">
            {totalSolved}
          </span>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">DSA Problems</span>
        </div>

        <div className="bg-surface-elevated border border-zinc-200 dark:border-zinc-800/80 p-4 rounded-2xl">
          <span className="text-[10px] uppercase text-zinc-500 block font-semibold tracking-wider">
            Focus Time
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span
              suppressHydrationWarning
              className="text-2xl font-bold text-zinc-900 dark:text-zinc-100"
            >
              {displayedTotalMinutes}
            </span>
            <span className="text-xs text-zinc-500 font-semibold">mins</span>
            {displayedTotalMinutes >= 60 && (
              <span
                suppressHydrationWarning
                className="text-[10px] text-zinc-500 font-normal"
              >
                ({Math.round((displayedTotalMinutes / 60) * 10) / 10}h)
              </span>
            )}
          </div>
          <span
            suppressHydrationWarning
            className="text-[10px] text-zinc-500 dark:text-zinc-400 block mt-0.5"
          >
            Today: {displayedTodayMinutes}m • {focusStats?.total_sessions ?? 0}{" "}
            Pomodoros
          </span>
        </div>

        <div className="bg-surface-elevated border border-zinc-200 dark:border-zinc-800/80 p-4 rounded-2xl">
          <span className="text-[10px] uppercase text-zinc-500 block font-semibold tracking-wider">
            Active Streak
          </span>
          <span className="text-2xl font-bold text-accent mt-1 block flex items-center gap-1.5">
            <Flame className="w-5 h-5 text-accent" />
            {streak}d
          </span>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Consistency Ledger</span>
        </div>

        <div className="bg-surface-elevated border border-zinc-200 dark:border-zinc-800/80 p-4 rounded-2xl">
          <span className="text-[10px] uppercase text-zinc-500 block font-semibold tracking-wider">
            Longest Streak
          </span>
          <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 block">
            {stats?.longest_streak_days ?? 0}d
          </span>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Personal Best</span>
        </div>
      </div>

      {/* 1-CLICK PROFILE AUTO-SYNC SECTION */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-400" /> Competitive
              Coding Auto-Sync
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              1-Click synchronization with public LeetCode and Codeforces
              profiles
            </p>
          </div>
          <span className="text-[10px] text-zinc-500 bg-zinc-950 border border-zinc-800 px-2 py-1 rounded-md">
            Direct Public APIs
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* LeetCode Sync Card */}
          <form
            onSubmit={handleSyncLeetCode}
            className="p-4 bg-zinc-950/70 border border-zinc-800 rounded-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-500 dark:text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 dark:bg-amber-400" />
                LeetCode Profile
              </div>
              {lcResult && (
                <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Synced
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="LeetCode username (e.g. neetcode)"
                value={lcUsername}
                onChange={(e) => setLcUsername(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs rounded-lg text-zinc-200 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={syncingLc}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {syncingLc ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  "Sync"
                )}
              </button>
            </div>

            {lcResult && (
              <div className="pt-2 border-t border-zinc-900 grid grid-cols-3 gap-2 text-center">
                <div className="bg-zinc-900/60 p-2 rounded-lg">
                  <span className="text-[9px] text-zinc-500 block">Total</span>
                  <span className="text-sm font-bold text-zinc-200">
                    {lcResult.total_solved}
                  </span>
                </div>
                <div className="bg-zinc-900/60 p-2 rounded-lg">
                  <span className="text-[9px] text-emerald-500 block">
                    Easy/Med
                  </span>
                  <span className="text-sm font-bold text-emerald-400">
                    {lcResult.easy_solved + lcResult.medium_solved}
                  </span>
                </div>
                <div className="bg-zinc-900/60 p-2 rounded-lg">
                  <span className="text-[9px] text-rose-500 block">Hard</span>
                  <span className="text-sm font-bold text-rose-400">
                    {lcResult.hard_solved}
                  </span>
                </div>
              </div>
            )}

            {lcError && (
              <p className="text-[11px] text-rose-400 bg-rose-950/40 p-2 rounded-lg border border-rose-900/50">
                {lcError}
              </p>
            )}
          </form>

          {/* Codeforces Sync Card */}
          <form
            onSubmit={handleSyncCodeforces}
            className="p-4 bg-zinc-950/70 border border-zinc-800 rounded-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-xs text-blue-500 dark:text-blue-400">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 dark:bg-blue-400" />
                Codeforces Handle
              </div>
              {cfResult && (
                <span className="text-[10px] text-blue-400 bg-blue-950/60 border border-blue-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Synced
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Codeforces handle (e.g. tourist)"
                value={cfHandle}
                onChange={(e) => setCfHandle(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs rounded-lg text-zinc-200 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={syncingCf}
                className="px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-black font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {syncingCf ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  "Sync"
                )}
              </button>
            </div>

            {cfResult && (
              <div className="pt-2 border-t border-zinc-900 grid grid-cols-3 gap-2 text-center">
                <div className="bg-zinc-900/60 p-2 rounded-lg">
                  <span className="text-[9px] text-zinc-500 block">Rating</span>
                  <span className="text-sm font-bold text-blue-400">
                    {cfResult.rating || "Unrated"}
                  </span>
                </div>
                <div className="bg-zinc-900/60 p-2 rounded-lg col-span-2">
                  <span className="text-[9px] text-zinc-500 block">
                    Rank / Solved
                  </span>
                  <span className="text-xs font-bold text-zinc-200">
                    {cfResult.rank || "Participant"} • {cfResult.total_solved}{" "}
                    solved
                  </span>
                </div>
              </div>
            )}

            {cfError && (
              <p className="text-[11px] text-rose-400 bg-rose-950/40 p-2 rounded-lg border border-rose-900/50">
                {cfError}
              </p>
            )}
          </form>
        </div>
      </div>

      {/* CHARTS GRID: FOCUS TRENDS & PLATFORM / DIFFICULTY BREAKDOWN */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* CHART 1: Focus Time Trend (Last 7 Days) */}
        <div className="md:col-span-6 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" /> Focus Time Trend (7
                Days)
              </h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Daily deep work minutes logged by Pomodoro
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-cyan-400 font-bold">
                {displayedTodayMinutes}m
              </span>
              <span className="text-[10px] text-zinc-500 block">Today</span>
            </div>
          </div>

          {/* SVG Bar Chart */}
          <div className="h-44 w-full flex items-end justify-between gap-2 pt-4 px-2">
            {(focusStats?.daily_stats || []).map((day) => {
              const heightPercent = Math.max(
                Math.round((day.focus_minutes / maxFocusMinutes) * 100),
                day.focus_minutes > 0 ? 10 : 4,
              );
              const dayLabel = day.date.slice(5);

              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center gap-2 group relative"
                >
                  <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 border border-zinc-700 text-white text-[10px] px-2 py-0.5 rounded shadow-lg pointer-events-none z-20 whitespace-nowrap">
                    {day.focus_minutes} mins ({day.sessions_count} sprints)
                  </div>

                  <div className="w-full bg-zinc-900/60 rounded-t-lg h-32 flex items-end p-1">
                    <div
                      className={`w-full rounded-md transition-all duration-500 ${
                        day.focus_minutes > 0
                          ? "bg-accent"
                          : "bg-zinc-800"
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>

                  <span className="text-[10px] text-zinc-500">{dayLabel}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* CHART 2: Symmetrical Platform & Difficulty Breakdown with Dual View */}
        <div className="md:col-span-6 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-purple-400" /> Platform &
                Difficulty Breakdown
              </h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {breakdownView === "logged"
                  ? "DSA problems logged in your daily arena & timetable"
                  : "Lifetime solved count verified via platform public APIs"}
              </p>
            </div>

            {/* View Switcher Pill */}
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setBreakdownView("logged")}
                className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  breakdownView === "logged"
                    ? "bg-zinc-800 text-purple-300 shadow-sm border border-zinc-700/80"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                App Logs ({loggedTotal})
              </button>
              <button
                type="button"
                onClick={() => setBreakdownView("profiles")}
                className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  breakdownView === "profiles"
                    ? "bg-zinc-800 text-cyan-300 shadow-sm border border-zinc-700/80"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Profiles ({profileTotal})
              </button>
            </div>
          </div>

          {/* VIEW A: LOGGED IN APP */}
          {breakdownView === "logged" ? (
            <>
              {/* Symmetrical Platform Cards */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* LeetCode Card */}
                <div className="p-3 bg-zinc-950 border border-zinc-800/90 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-amber-500 dark:text-amber-400 font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400" />{" "}
                      LeetCode
                    </span>
                    <span className="text-zinc-200 font-mono font-black text-sm">
                      {loggedPlatforms.leetcode.count}
                    </span>
                  </div>
                  <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${loggedPlatforms.leetcode.pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span>{loggedPlatforms.leetcode.pct}% of pool</span>
                    <span>Arena Log</span>
                  </div>
                </div>

                {/* Codeforces Card */}
                <div className="p-3 bg-zinc-950 border border-zinc-800/90 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-blue-500 dark:text-blue-400 font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" />{" "}
                      Codeforces
                    </span>
                    <span className="text-zinc-200 font-mono font-black text-sm">
                      {loggedPlatforms.codeforces.count}
                    </span>
                  </div>
                  <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${loggedPlatforms.codeforces.pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span>{loggedPlatforms.codeforces.pct}% of pool</span>
                    <span>Arena Log</span>
                  </div>
                </div>
              </div>

              {/* Difficulty Tiers */}
              <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                    Difficulty Tiers (Logged Problems)
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {loggedDifficulties.reduce((a, c) => a + c.count, 0)}{" "}
                    classified
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {loggedDifficulties.map((d) => (
                    <div
                      key={d.difficulty}
                      className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/90 flex flex-col justify-between"
                    >
                      <span
                        className="font-bold text-[11px] block"
                        style={{ color: d.color }}
                      >
                        {d.difficulty}
                      </span>
                      <div className="my-1.5">
                        <span className="text-base text-zinc-100 font-black font-mono block leading-none">
                          {d.count}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {d.pct}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${d.pct}%`,
                            backgroundColor: d.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-[10px] text-zinc-500 pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                <span>Aggregated from timetable & manual arena logs</span>
                <span className="text-emerald-400 font-mono font-bold">
                  {loggedTotal} total logged
                </span>
              </div>
            </>
          ) : (
            /* VIEW B: LIVE PROFILE STATS */
            <>
              {/* Symmetrical Profile Cards */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* LeetCode Profile Card */}
                <div className="p-3 bg-zinc-950 border border-zinc-800/90 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-amber-500 dark:text-amber-400 font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400" />{" "}
                      LeetCode
                    </span>
                    <span className="text-zinc-200 font-mono font-black text-sm">
                      {lcResult?.total_solved ?? 0}
                    </span>
                  </div>
                  <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${profilePlatforms.leetcode.pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span>{profilePlatforms.leetcode.pct}% of profiles</span>
                    <span className="text-zinc-400 truncate max-w-[90px]">
                      {lcResult?.rank ||
                        (lcUsername ? `@${lcUsername}` : "Not synced")}
                    </span>
                  </div>
                </div>

                {/* Codeforces Profile Card */}
                <div className="p-3 bg-zinc-950 border border-zinc-800/90 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-blue-500 dark:text-blue-400 font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" />{" "}
                      Codeforces
                    </span>
                    <span className="text-zinc-200 font-mono font-black text-sm">
                      {cfResult?.total_solved ?? 0}
                    </span>
                  </div>
                  <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${profilePlatforms.codeforces.pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span>{profilePlatforms.codeforces.pct}% of profiles</span>
                    <span className="text-zinc-400 truncate max-w-[90px]">
                      {cfResult?.rating
                        ? `Rating ${cfResult.rating}`
                        : cfHandle
                          ? `@${cfHandle}`
                          : "Not synced"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Profile Difficulty Tiers */}
              <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                    Difficulty Tiers (Combined Profiles)
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {profileDifficulties.reduce((a, c) => a + c.count, 0)} total
                    solved
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {profileDifficulties.map((d) => (
                    <div
                      key={d.difficulty}
                      className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/90 flex flex-col justify-between"
                    >
                      <span
                        className="font-bold text-[11px] block"
                        style={{ color: d.color }}
                      >
                        {d.difficulty}
                      </span>
                      <div className="my-1.5">
                        <span className="text-base text-zinc-100 font-black font-mono block leading-none">
                          {d.count}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {d.pct}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${d.pct}%`,
                            backgroundColor: d.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-[10px] text-zinc-500 pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                <span>Verified via LeetCode & Codeforces Public APIs</span>
                <span className="text-cyan-400 font-mono font-bold">
                  {profileTotal} lifetime solved
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* EXPANDED BADGES & CELEBRATION SECTION */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" /> Milestones & Badges
              ({badges.filter((b) => b.unlocked).length} / {badges.length}{" "}
              Unlocked)
            </h3>
            <p className="text-[11px] text-zinc-500">
              Click an unlocked badge to celebrate with sound & confetti! 🎉
            </p>
          </div>

          <button
            onClick={() => setShowAllBadgesModal(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/80 text-emerald-300 text-xs font-bold transition cursor-pointer self-start sm:self-auto shadow-sm"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>View All Badges ({badges.length})</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {badges.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.id}
                onClick={() => b.unlocked && triggerBadgeCelebration(b)}
                className={`p-4 rounded-2xl border flex items-start gap-3.5 transition-all ${
                  b.unlocked
                    ? "bg-zinc-900/70 hover:bg-zinc-900 border-zinc-700 shadow-sm cursor-pointer hover:border-emerald-500/70 hover:scale-[1.01]"
                    : "bg-zinc-950/40 border-zinc-800/40 opacity-45 grayscale cursor-not-allowed"
                }`}
              >
                <div
                  className={`p-2.5 rounded-xl border shrink-0 ${
                    b.unlocked
                      ? "bg-emerald-950/70 border-emerald-700 text-emerald-400 shadow-xs"
                      : "bg-zinc-900 border-zinc-800 text-zinc-600"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-xs font-bold text-zinc-200 truncate">
                      {b.title}
                    </h4>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                      {b.tier}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                    {b.desc}
                  </p>
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-zinc-800/50">
                    <span
                      className={`text-[10px] font-bold ${
                        b.unlocked ? "text-emerald-400" : "text-zinc-600"
                      }`}
                    >
                      {b.unlocked ? "✓ UNLOCKED • CELEBRATE" : "LOCKED"}
                    </span>
                    <span className="text-[9px] text-zinc-500 uppercase">
                      {b.category}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BADGE CELEBRATION MODAL */}
      {celebratingBadge && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md rounded-3xl p-6 text-center space-y-4 shadow-2xl relative overflow-hidden">
            <button
              onClick={() => setCelebratingBadge(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Emblem */}
            <div className="mx-auto w-20 h-20 rounded-3xl bg-accent p-0.5 shadow-md">
              <div className="w-full h-full bg-zinc-950 rounded-[22px] flex items-center justify-center text-accent">
                {(() => {
                  const Icon = celebratingBadge.icon;
                  return <Icon className="w-10 h-10" />;
                })()}
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-accent bg-accent-subtle border border-accent px-3 py-1 rounded-full inline-block mb-1.5">
                {celebratingBadge.tier} Tier Milestone
              </span>
              <h3 className="text-xl font-bold text-white">
                {celebratingBadge.title}
              </h3>
              <p className="text-xs text-zinc-300 mt-2">
                {celebratingBadge.desc}
              </p>
              <p className="text-[11px] text-zinc-500 italic mt-2 bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-800/80">
                &ldquo;{celebratingBadge.lore}&rdquo;
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  playCelebrationSound();
                  confetti({
                    particleCount: 120,
                    spread: 80,
                    origin: { y: 0.5 },
                  });
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-accent hover:opacity-90 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Sparkles className="w-4 h-4" /> Celebrate Again
              </button>
              <button
                onClick={() => setCelebratingBadge(null)}
                className="py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW ALL BADGES & ACHIEVEMENTS MODAL */}
      {showAllBadgesModal && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-4xl max-h-[90vh] rounded-3xl p-5 sm:p-6 flex flex-col shadow-2xl relative overflow-hidden font-mono">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-950/60 border border-emerald-800 text-emerald-400 rounded-2xl">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    Hall of Achievements & Badges
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {badges.filter((b) => b.unlocked).length} of {badges.length}{" "}
                    unlocked (
                    {Math.round(
                      (badges.filter((b) => b.unlocked).length /
                        badges.length) *
                        100,
                    )}
                    % complete)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAllBadgesModal(false)}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="pt-4 pb-2 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search badge name, lore, or tier..."
                    value={badgeSearchQuery}
                    onChange={(e) => setBadgeSearchQuery(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Status Toggle */}
                <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800 self-start sm:self-auto">
                  {(["all", "unlocked", "locked"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setBadgeStatusFilter(s)}
                      className={`px-3 py-1 rounded-lg text-xs capitalize transition cursor-pointer ${
                        badgeStatusFilter === s
                          ? "bg-zinc-800 text-emerald-400 font-bold border border-zinc-700"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {["All", "DSA", "Streak", "Focus", "Special"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setBadgeCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-lg text-xs transition cursor-pointer whitespace-nowrap ${
                      badgeCategoryFilter === cat
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold"
                        : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Badges Grid Scroll Area */}
            <div className="flex-1 overflow-y-auto pt-4 pr-1 space-y-3 scrollbar-thin scrollbar-thumb-zinc-800 max-h-[55vh]">
              {filteredBadges.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs">
                  No badges found matching your search.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredBadges.map((b) => {
                    const Icon = b.icon;
                    return (
                      <div
                        key={b.id}
                        onClick={() => {
                          if (b.unlocked) {
                            triggerBadgeCelebration(b);
                          }
                        }}
                        className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
                          b.unlocked
                            ? "bg-zinc-900/80 hover:bg-zinc-900 border-zinc-700 cursor-pointer hover:border-emerald-500 hover:scale-[1.01]"
                            : "bg-zinc-950 border-zinc-900 opacity-40 grayscale cursor-not-allowed"
                        }`}
                      >
                        <div
                          className={`p-2.5 rounded-xl border shrink-0 ${
                            b.unlocked
                              ? "bg-emerald-950 border-emerald-700 text-emerald-400 shadow-xs"
                              : "bg-zinc-900 border-zinc-800 text-zinc-600"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold text-zinc-200 truncate">
                              {b.title}
                            </h4>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                              {b.tier}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                            {b.desc}
                          </p>
                          <p className="text-[10px] text-zinc-500 italic mt-1.5 bg-zinc-950/80 p-1.5 rounded-lg border border-zinc-900">
                            &ldquo;{b.lore}&rdquo;
                          </p>
                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-zinc-800/60">
                            <span
                              className={`text-[10px] font-bold ${
                                b.unlocked
                                  ? "text-emerald-400"
                                  : "text-zinc-600"
                              }`}
                            >
                              {b.unlocked ? "✓ UNLOCKED • CELEBRATE" : "LOCKED"}
                            </span>
                            <span className="text-[9px] text-zinc-500 uppercase">
                              {b.category}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
