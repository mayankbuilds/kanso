import {
  CodingAnalytics,
  CodingLog,
  CodingSyncResult,
  HeatmapDay,
  DailyFocus,
  FocusSession,
  FocusStats,
  StudentRoutine,
  UserStats,
} from "@/types";
import {
  STORAGE_KEYS,
  getLocal,
  setLocal,
  recordUserActivity,
  getStreakStatus,
} from "@/lib/storage";
import { getLocalDateString } from "@/lib/dateUtils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new Error("Local-first mode: No remote backend URL defined");
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout before falling back

    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      signal: controller.signal,
      ...options,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new Error(
        errorBody.detail || `Request failed with status ${res.status}`,
      );
    }

    if (res.status === 204) {
      return {} as T;
    }

    return await res.json();
  } catch (err) {
    // Pass error to offline fallback handlers
    throw err;
  }
}

export const api = {
  // Coding Arena & Analytics
  getHeatmap: async (days: number = 112): Promise<HeatmapDay[]> => {
    try {
      const data = await request<HeatmapDay[]>(`/coding/heatmap?days=${days}`);
      setLocal(STORAGE_KEYS.CACHED_HEATMAP, data);
      return data;
    } catch {
      // Local fallback
      const logs = getLocal<CodingLog[]>(STORAGE_KEYS.LOGS, []);
      const countMap: Record<string, number> = {};
      logs.forEach((l) => {
        const d = l.solved_at.slice(0, 10);
        countMap[d] = (countMap[d] || 0) + 1;
      });

      const today = new Date();
      const result: HeatmapDay[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dStr = getLocalDateString(d);
        result.push({ date: dStr, count: countMap[dStr] || 0 });
      }
      return result;
    }
  },

  getRecentLogs: async (
    limit: number = 10,
    offset: number = 0,
  ): Promise<CodingLog[]> => {
    try {
      const data = await request<CodingLog[]>(
        `/coding/logs?limit=${limit}&offset=${offset}`,
      );
      setLocal(STORAGE_KEYS.LOGS, data);
      return data;
    } catch {
      const logs = getLocal<CodingLog[]>(STORAGE_KEYS.LOGS, []);
      return logs.slice(offset, offset + limit);
    }
  },

  logProblem: async (data: {
    problem_title: string;
    platform: string;
    difficulty: string;
    topic_tag: string;
  }): Promise<CodingLog> => {
    try {
      const item = await request<CodingLog>("/coding/logs", {
        method: "POST",
        body: JSON.stringify(data),
      });
      const localLogs = getLocal<CodingLog[]>(STORAGE_KEYS.LOGS, []);
      setLocal(STORAGE_KEYS.LOGS, [item, ...localLogs]);
      return item;
    } catch {
      // Offline local creation
      const localLogs = getLocal<CodingLog[]>(STORAGE_KEYS.LOGS, []);
      const newLog: CodingLog = {
        id: Date.now(),
        problem_title: data.problem_title,
        platform: data.platform,
        difficulty: data.difficulty,
        topic_tag: data.topic_tag,
        solved_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      setLocal(STORAGE_KEYS.LOGS, [newLog, ...localLogs]);

      // Calculate streak and award XP via central engine
      const xpToAdd =
        data.difficulty === "Easy" ? 10 : data.difficulty === "Medium" ? 25 : 50;
      recordUserActivity(xpToAdd);

      return newLog;
    }
  },

  updateCodingLog: async (
    id: number,
    data: {
      problem_title?: string;
      platform?: string;
      difficulty?: string;
      topic_tag?: string;
    },
  ): Promise<CodingLog> => {
    try {
      const item = await request<CodingLog>(`/coding/logs/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      const localLogs = getLocal<CodingLog[]>("streakflow_logs", []);
      setLocal(
        "streakflow_logs",
        localLogs.map((l) => (l.id === id ? item : l)),
      );
      return item;
    } catch {
      const localLogs = getLocal<CodingLog[]>("streakflow_logs", []);
      const existing = localLogs.find((l) => l.id === id);
      const updated: CodingLog = existing
        ? { ...existing, ...data }
        : ({
            id,
            problem_title: data.problem_title || "",
            platform: data.platform || "LeetCode",
            difficulty: data.difficulty || "Medium",
            topic_tag: data.topic_tag || "General",
            solved_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          } as CodingLog);
      setLocal(
        "streakflow_logs",
        localLogs.map((l) => (l.id === id ? updated : l)),
      );
      return updated;
    }
  },

  deleteCodingLog: async (id: number): Promise<void> => {
    try {
      await request<void>(`/coding/logs/${id}`, { method: "DELETE" });
    } catch {}
    const localLogs = getLocal<CodingLog[]>("streakflow_logs", []);
    setLocal(
      "streakflow_logs",
      localLogs.filter((l) => l.id !== id),
    );
  },

  getCodingAnalytics: async (): Promise<CodingAnalytics> => {
    try {
      const data = await request<CodingAnalytics>("/coding/analytics");
      setLocal("streakflow_analytics", data);
      return data;
    } catch {
      const logs = getLocal<CodingLog[]>("streakflow_logs", []);
      const total_solved = logs.length;

      const platMap: Record<string, number> = {};
      const diffMap: Record<string, number> = { Easy: 0, Medium: 0, Hard: 0 };
      logs.forEach((l) => {
        platMap[l.platform] = (platMap[l.platform] || 0) + 1;
        if (diffMap[l.difficulty] !== undefined) {
          diffMap[l.difficulty]++;
        } else {
          diffMap["Medium"]++;
        }
      });

      return {
        total_solved,
        platform_breakdown: Object.entries(platMap).map(([p, count]) => ({
          platform: p,
          count,
          color:
            p === "LeetCode"
              ? "#f59e0b"
              : p === "Codeforces"
                ? "#3b82f6"
                : "#10b981",
        })),
        difficulty_breakdown: [
          { difficulty: "Easy", count: diffMap["Easy"], color: "#10b981" },
          { difficulty: "Medium", count: diffMap["Medium"], color: "#f59e0b" },
          { difficulty: "Hard", count: diffMap["Hard"], color: "#ef4444" },
        ],
      };
    }
  },

  syncLeetCode: async (username: string): Promise<CodingSyncResult> => {
    // Direct serverless route handler on Vercel / Next.js
    const res = await fetch(
      `/api/sync/leetcode?username=${encodeURIComponent(username)}`,
    );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `LeetCode sync failed (${res.status})`);
      }
      const data = await res.json();

      const localLogs = getLocal<CodingLog[]>("streakflow_logs", []);
      const existingTitles = new Set(
        localLogs.map((l) => l.problem_title.toLowerCase()),
      );
      let syncedCount = 0;
      let updatedCount = 0;
      const newLogs: CodingLog[] = [];

      data.recent_submissions?.forEach(
        (sub: {
          title: string;
          slug: string;
          difficulty?: string;
          timestamp: number;
          url: string;
        }) => {
          const diff = sub.difficulty || "Medium";
          const titleLower = sub.title.toLowerCase();

          // If already exists, update its difficulty to the accurate one
          const existing = localLogs.find(
            (l) => l.problem_title.toLowerCase() === titleLower,
          );
          if (existing) {
            if (existing.difficulty !== diff) {
              existing.difficulty = diff;
              updatedCount++;
            }
          } else if (!existingTitles.has(titleLower)) {
            existingTitles.add(titleLower);
            syncedCount++;
            const d = sub.timestamp
              ? new Date(sub.timestamp * 1000)
              : new Date();
            newLogs.push({
              id: Date.now() + Math.random(),
              problem_title: sub.title,
              platform: "LeetCode",
              difficulty: diff,
              topic_tag: "LeetCode Sync",
              problem_url: sub.url,
              solved_at: d.toISOString().slice(0, 10),
              created_at: new Date().toISOString(),
            });
          }
        },
      );

      if (newLogs.length > 0 || updatedCount > 0) {
        setLocal(STORAGE_KEYS.LOGS, [...newLogs, ...localLogs]);
        if (newLogs.length > 0) {
          recordUserActivity(syncedCount * 30);
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("streakflow-stats-updated"));
        }
      }

      return {
        platform: "LeetCode",
        handle: username,
        total_solved: data.total_solved,
        easy_solved: data.easy_solved,
        medium_solved: data.medium_solved,
        hard_solved: data.hard_solved,
        rank: data.rank,
        synced_problems_count: syncedCount,
        message: `Synced ${syncedCount} new problem(s) from LeetCode! Total solved: ${data.total_solved}`,
      };
  },

  syncCodeforces: async (handle: string): Promise<CodingSyncResult> => {
    // Direct serverless route handler on Vercel / Next.js
    const res = await fetch(
      `/api/sync/codeforces?handle=${encodeURIComponent(handle)}`,
    );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Codeforces sync failed (${res.status})`);
      }
      const data = await res.json();

      const localLogs = getLocal<CodingLog[]>(STORAGE_KEYS.LOGS, []);
      const existingTitles = new Set(
        localLogs.map((l) => l.problem_title.toLowerCase()),
      );
      let syncedCount = 0;
      const newLogs: CodingLog[] = [];

      data.recent_submissions?.forEach(
        (sub: {
          title: string;
          difficulty: string;
          timestamp: number;
          url: string;
        }) => {
          if (!existingTitles.has(sub.title.toLowerCase())) {
            existingTitles.add(sub.title.toLowerCase());
            syncedCount++;
            const d = sub.timestamp
              ? new Date(sub.timestamp * 1000)
              : new Date();
            newLogs.push({
              id: Date.now() + Math.random(),
              problem_title: sub.title,
              platform: "Codeforces",
              difficulty: sub.difficulty,
              topic_tag: "Codeforces Sync",
              problem_url: sub.url,
              solved_at: getLocalDateString(d),
              created_at: new Date().toISOString(),
            });
          }
        },
      );

      if (newLogs.length > 0) {
        setLocal(STORAGE_KEYS.LOGS, [...newLogs, ...localLogs]);
        recordUserActivity(syncedCount * 30);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("streakflow-stats-updated"));
        }
      }

      return {
        platform: "Codeforces",
        handle,
        total_solved: data.total_solved,
        easy_solved: data.easy_solved,
        medium_solved: data.medium_solved,
        hard_solved: data.hard_solved,
        rank: data.rank,
        synced_problems_count: syncedCount,
        message: `Synced ${syncedCount} new problem(s) from Codeforces! Total solved: ${data.total_solved}`,
      };
  },

  // Rule of 3 Focus & Focus Sessions
  getTodayFocus: async (): Promise<DailyFocus[]> => {
    const today = getLocalDateString();
    try {
      const data = await request<DailyFocus[]>("/focus/today");
      setLocal(STORAGE_KEYS.FOCUS, data);
      return data;
    } catch {
      const allFocus = getLocal<DailyFocus[]>(STORAGE_KEYS.FOCUS, []);
      return allFocus.filter((f) => f.target_date === today);
    }
  },

  setFocusSlot: async (data: {
    priority_order: number;
    title: string;
  }): Promise<DailyFocus> => {
    const today = getLocalDateString();
    try {
      const item = await request<DailyFocus>("/focus", {
        method: "POST",
        body: JSON.stringify(data),
      });
      const local = getLocal<DailyFocus[]>(STORAGE_KEYS.FOCUS, []);
      const filtered = local.filter(
        (f) => f.priority_order !== data.priority_order,
      );
      setLocal(STORAGE_KEYS.FOCUS, [...filtered, item]);
      return item;
    } catch {
      const local = getLocal<DailyFocus[]>(STORAGE_KEYS.FOCUS, []);
      const filtered = local.filter(
        (f) => f.priority_order !== data.priority_order,
      );
      const newItem: DailyFocus = {
        id: Date.now(),
        priority_order: data.priority_order,
        title: data.title,
        target_date: today,
        is_completed: false,
        created_at: new Date().toISOString(),
      };
      setLocal(STORAGE_KEYS.FOCUS, [...filtered, newItem]);
      return newItem;
    }
  },

  updateFocusTask: async (
    id: number,
    data: { is_completed?: boolean; title?: string },
  ): Promise<DailyFocus> => {
    const today = getLocalDateString();
    try {
      const item = await request<DailyFocus>(`/focus/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      const local = getLocal<DailyFocus[]>(STORAGE_KEYS.FOCUS, []);
      setLocal(
        STORAGE_KEYS.FOCUS,
        local.map((f) => (f.id === id ? item : f)),
      );
      return item;
    } catch {
      const local = getLocal<DailyFocus[]>(STORAGE_KEYS.FOCUS, []);
      const existing = local.find((f) => f.id === id);
      if (
        data.is_completed !== undefined &&
        existing &&
        existing.is_completed !== data.is_completed
      ) {
        if (data.is_completed) {
          recordUserActivity(20);
        } else {
          const stats = getLocal<UserStats>(STORAGE_KEYS.USER_STATS, {
            id: 1,
            xp: 100,
            level: 1,
            current_streak_days: 0,
            longest_streak_days: 0,
            last_active_date: null,
          });
          stats.xp = Math.max(0, stats.xp - 20);
          stats.level = Math.floor(stats.xp / 300) + 1;
          setLocal(STORAGE_KEYS.USER_STATS, stats);
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("streakflow-stats-updated"));
        }
      }
      const updated: DailyFocus = existing
        ? { ...existing, ...data }
        : ({
            id,
            priority_order: 1,
            title: data.title || "",
            target_date: today,
            is_completed: Boolean(data.is_completed),
            created_at: new Date().toISOString(),
          } as DailyFocus);
      setLocal(
        STORAGE_KEYS.FOCUS,
        local.map((f) => (f.id === id ? updated : f)),
      );
      return updated;
    }
  },

  deleteFocusTask: async (id: number): Promise<void> => {
    try {
      await request<void>(`/focus/${id}`, { method: "DELETE" });
    } catch {}
    const local = getLocal<DailyFocus[]>(STORAGE_KEYS.FOCUS, []);
    setLocal(
      STORAGE_KEYS.FOCUS,
      local.filter((f) => f.id !== id),
    );
  },

  logFocusSession: async (data: {
    duration_seconds: number;
    session_type?: string;
    xp_earned?: number;
  }): Promise<FocusSession> => {
    const today = getLocalDateString();
    const addedMinutes = Math.max(1, Math.round(data.duration_seconds / 60));

    // Update local cache immediately
    if (typeof window !== "undefined") {
      const todayKey = `${STORAGE_KEYS.FOCUS_TODAY_PREFIX}${today}`;
      const currToday = parseInt(localStorage.getItem(todayKey) || "0", 10);
      localStorage.setItem(todayKey, (currToday + addedMinutes).toString());

      const totalKey = STORAGE_KEYS.FOCUS_TOTAL_COMPLETED_MINS;
      const currTotal = parseInt(localStorage.getItem(totalKey) || "0", 10);
      localStorage.setItem(totalKey, (currTotal + addedMinutes).toString());
    }

    try {
      const item = await request<FocusSession>("/focus/sessions", {
        method: "POST",
        body: JSON.stringify(data),
      });
      const sessions = getLocal<FocusSession[]>("kanso_sessions", []);
      setLocal("kanso_sessions", [item, ...sessions]);
      return item;
    } catch {
      const sessions = getLocal<FocusSession[]>("kanso_sessions", []);
      const newSession: FocusSession = {
        id: Date.now(),
        duration_seconds: data.duration_seconds,
        session_type: data.session_type || "focus",
        target_date: today,
        xp_earned: data.xp_earned || 50,
        completed_at: new Date().toISOString(),
      };
      setLocal("kanso_sessions", [newSession, ...sessions]);

      // Central activity & streak evaluation
      recordUserActivity(data.xp_earned || 50);

      return newSession;
    }
  },

  getFocusStats: async (days: number = 7): Promise<FocusStats> => {
    try {
      const data = await request<FocusStats>(`/focus/stats?days=${days}`);
      setLocal("streakflow_cached_focus_stats", data);
      return data;
    } catch {
      const sessions = getLocal<FocusSession[]>("streakflow_sessions", []);
      const today = new Date().toISOString().slice(0, 10);

      const total_seconds = sessions.reduce(
        (acc, s) => acc + (s.duration_seconds || 0),
        0,
      );
      const total_focus_minutes = Math.round(total_seconds / 60);

      const todaySessions = sessions.filter((s) => s.target_date === today);
      const today_seconds = todaySessions.reduce(
        (acc, s) => acc + (s.duration_seconds || 0),
        0,
      );
      const today_focus_minutes = Math.round(today_seconds / 60);

      const daily_stats = [];
      const now = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().slice(0, 10);
        const daySessions = sessions.filter((s) => s.target_date === dStr);
        const daySeconds = daySessions.reduce(
          (acc, s) => acc + (s.duration_seconds || 0),
          0,
        );
        daily_stats.push({
          date: dStr,
          focus_minutes: Math.round(daySeconds / 60),
          sessions_count: daySessions.length,
        });
      }

      return {
        total_focus_minutes,
        today_focus_minutes,
        total_sessions: sessions.length,
        daily_stats,
      };
    }
  },

  // Student Routines (Timetable)
  getRoutines: async (): Promise<StudentRoutine[]> => {
    try {
      const data = await request<StudentRoutine[]>("/routines");
      setLocal("streakflow_routines", data);
      return data;
    } catch {
      return getLocal<StudentRoutine[]>("streakflow_routines", []);
    }
  },

  createRoutine: async (data: {
    title: string;
    start_time: string;
    end_time: string;
    category: string;
    scheduled_date?: string | null;
  }): Promise<StudentRoutine> => {
    try {
      const item = await request<StudentRoutine>("/routines", {
        method: "POST",
        body: JSON.stringify(data),
      });
      const local = getLocal<StudentRoutine[]>("streakflow_routines", []);
      setLocal("streakflow_routines", [...local, item]);
      return item;
    } catch {
      const local = getLocal<StudentRoutine[]>("streakflow_routines", []);
      const newItem: StudentRoutine = {
        id: Date.now(),
        title: data.title,
        start_time: data.start_time,
        end_time: data.end_time,
        category: data.category,
        scheduled_date: data.scheduled_date || null,
        is_completed_today: false,
        created_at: new Date().toISOString(),
      };
      setLocal("streakflow_routines", [...local, newItem]);
      return newItem;
    }
  },

  updateRoutine: async (
    id: number,
    data: {
      title?: string;
      start_time?: string;
      end_time?: string;
      category?: string;
      scheduled_date?: string | null;
      is_completed_today?: boolean;
    },
  ): Promise<StudentRoutine> => {
    try {
      const item = await request<StudentRoutine>(`/routines/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      const local = getLocal<StudentRoutine[]>("streakflow_routines", []);
      setLocal(
        "streakflow_routines",
        local.map((r) => (r.id === id ? item : r)),
      );
      return item;
    } catch {
      const local = getLocal<StudentRoutine[]>("streakflow_routines", []);
      const existing = local.find((r) => r.id === id);
      const updated: StudentRoutine = existing
        ? { ...existing, ...data }
        : ({
            id,
            title: data.title || "",
            start_time: data.start_time || "09:00",
            end_time: data.end_time || "10:00",
            category: data.category || "DSA",
            scheduled_date: data.scheduled_date || null,
            is_completed_today: Boolean(data.is_completed_today),
            created_at: new Date().toISOString(),
          } as StudentRoutine);
      setLocal(
        "streakflow_routines",
        local.map((r) => (r.id === id ? updated : r)),
      );
      return updated;
    }
  },

  deleteRoutine: async (id: number): Promise<void> => {
    try {
      await request<void>(`/routines/${id}`, { method: "DELETE" });
    } catch {}
    const local = getLocal<StudentRoutine[]>("streakflow_routines", []);
    setLocal(
      "streakflow_routines",
      local.filter((r) => r.id !== id),
    );
  },

  toggleRoutine: async (id: number): Promise<StudentRoutine> => {
    try {
      const item = await request<StudentRoutine>(`/routines/${id}/toggle`, {
        method: "PATCH",
      });
      const local = getLocal<StudentRoutine[]>(STORAGE_KEYS.ROUTINES, []);
      setLocal(
        STORAGE_KEYS.ROUTINES,
        local.map((r) => (r.id === id ? item : r)),
      );
      return item;
    } catch {
      const local = getLocal<StudentRoutine[]>(STORAGE_KEYS.ROUTINES, []);
      const item = local.find((r) => r.id === id);
      if (item) {
        const nextState = !item.is_completed_today;
        item.is_completed_today = nextState;
        if (nextState) {
          item.last_completed_date = getLocalDateString();
          recordUserActivity(40);
        } else {
          item.last_completed_date = null;
          const current = getLocal<UserStats>(STORAGE_KEYS.USER_STATS, {
            id: 1,
            xp: 100,
            level: 1,
            current_streak_days: 0,
            longest_streak_days: 0,
            last_active_date: null,
          });
          const newXP = Math.max(0, current.xp - 40);
          setLocal(STORAGE_KEYS.USER_STATS, {
            ...current,
            xp: newXP,
            level: Math.floor(newXP / 300) + 1,
          });
        }
        setLocal(STORAGE_KEYS.ROUTINES, local);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("streakflow-stats-updated"));
        }
        return item;
      }
      throw new Error("Routine not found");
    }
  },

  // User Stats & XP
  getUserStats: async (): Promise<UserStats> => {
    try {
      const data = await request<UserStats>("/user/stats");
      setLocal(STORAGE_KEYS.USER_STATS, data);
      return data;
    } catch {
      const raw = getLocal<UserStats>(STORAGE_KEYS.USER_STATS, {
        id: 1,
        xp: 150,
        level: 1,
        current_streak_days: 0,
        longest_streak_days: 0,
        last_active_date: null,
      });
      const streakInfo = getStreakStatus(raw);
      return {
        ...raw,
        current_streak_days: streakInfo.currentStreak,
        longest_streak_days: streakInfo.longestStreak,
      };
    }
  },

  // Danger Zone / Reset
  resetAllData: async (): Promise<{ status: string; message: string }> => {
    if (typeof window !== "undefined") {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("streakflow_") || key.startsWith("kanso_"))) {
          // Preserve theme choice and safety backup snapshot
          if (
            key !== STORAGE_KEYS.THEME_MODE &&
            key !== STORAGE_KEYS.ACCENT_COLOR &&
            key !== "streakflow_theme_mode" &&
            key !== "streakflow_accent_color" &&
            key !== STORAGE_KEYS.LEGACY_BACKUP_SNAPSHOT
          ) {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));

      // Reset user stats to blank Level 1
      const freshStats: UserStats = {
        id: 1,
        xp: 0,
        level: 1,
        current_streak_days: 0,
        longest_streak_days: 0,
        last_active_date: null,
      };
      setLocal(STORAGE_KEYS.USER_STATS, freshStats);

      // Dispatch events across app
      window.dispatchEvent(new Event("streakflow-data-reset"));
      window.dispatchEvent(new Event("streakflow-stats-updated"));
      window.dispatchEvent(new Event("focus-session-completed"));
      window.dispatchEvent(
        new CustomEvent("kanso-storage-updated", { detail: { key: "all" } }),
      );
    }
    return { status: "success", message: "All user data reset successfully" };
  },
};