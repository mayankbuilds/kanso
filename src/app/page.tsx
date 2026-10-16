"use client";

import { useState, useEffect, useCallback } from "react";
import confetti from "canvas-confetti";
import {
  Terminal,
  Timer,
  CheckSquare,
  Award,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";
import Header from "@/components/navigation/Header";
import MobileNav, { NavTab } from "@/components/navigation/MobileNav";
import Heatmap from "@/components/arena/Heatmap";
import ProblemLogger from "@/components/arena/ProblemLogger";
import RecentLogs from "@/components/arena/RecentLogs";
import FocusSection from "@/components/focus/FocusSection";
import RoutineSection from "@/components/routine/RoutineSection";
import AchievementsView from "@/components/stats/AchievementsView";
import SettingsView from "@/components/settings/SettingsView";
import TasksAndNotes from "@/components/tasks/TasksAndNotes";
import CalendarPicker from "@/components/ui/CalendarPicker";
import { api } from "@/lib/api";
import { driveSync } from "@/lib/driveSync";
import { initKansoStorage, checkAndApplyRollover } from "@/lib/storage";
import {
  getLocalDateString,
  formatDisplayDate,
  parseLocalDateString,
} from "@/lib/dateUtils";
import PomodoroTimer from "@/components/focus/PomodoroTimer";
import {
  CodingLog,
  HeatmapDay,
  DailyFocus,
  StudentRoutine,
  UserStats,
} from "@/types";

export default function Home() {
  const [activeTab, setActiveTab] = useState<NavTab>("arena");
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    getLocalDateString(),
  );
  const [stats, setStats] = useState<UserStats | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapDay[]>([]);
  const [recentLogs, setRecentLogs] = useState<CodingLog[]>([]);
  const [focusTasks, setFocusTasks] = useState<DailyFocus[]>([]);
  const [routines, setRoutines] = useState<StudentRoutine[]>([]);
  const [isPomodoroFullscreen, setIsPomodoroFullscreen] = useState(false);
  const [timerInfo, setTimerInfo] = useState<
    | {
        timeLeft: number;
        isRunning: boolean;
        mode: string;
      }
    | undefined
  >(undefined);

  const loadDashboard = useCallback(async () => {
    try {
      const [s, h, l, f, r] = await Promise.all([
        api.getUserStats(),
        api.getHeatmap(365),
        api.getRecentLogs(10),
        api.getTodayFocus(),
        api.getRoutines(),
      ]);
      setStats(s);
      setHeatmapData(h);
      setRecentLogs(l);
      setFocusTasks(f);
      setRoutines(r);
    } catch (err) {
      console.error("Dashboard failed to load:", err);
    }
  }, []);

  useEffect(() => {
    // 1. Initialize Kanso storage (idempotent legacy migration & daily rollover)
    initKansoStorage();
    loadDashboard();

    // 2. Periodic Google Drive Auto-Sync every 5 minutes if authenticated
    const autoSyncTimer = setInterval(
      () => {
        driveSync.triggerAutoSync();
      },
      5 * 60 * 1000,
    );

    const onDataChanged = () => {
      driveSync.scheduleAutoSync(2500);
    };

    const onStorageUpdated = () => {
      loadDashboard();
      driveSync.scheduleAutoSync(2500);
    };

    // 3. Re-check daily rollover when user resumes app or tab becomes visible
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const rollover = checkAndApplyRollover();
        if (rollover.rolledOver) {
          loadDashboard();
        }
      }
    };

    window.addEventListener("focus-session-completed", onDataChanged);
    window.addEventListener("streakflow-stats-updated", onDataChanged);
    window.addEventListener("kanso-storage-updated", onStorageUpdated);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(autoSyncTimer);
      window.removeEventListener("focus-session-completed", onDataChanged);
      window.removeEventListener("streakflow-stats-updated", onDataChanged);
      window.removeEventListener("kanso-storage-updated", onStorageUpdated);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadDashboard]);

  const handleSessionComplete = async () => {
    try {
      const s = await api.getUserStats();
      setStats(s);
    } catch (err) {
      console.error("Dashboard failed to load stats after pomodoro:", err);
    }
  };

  const handleLogProblem = async (data: {
    problem_title: string;
    platform: string;
    difficulty: string;
    topic_tag: string;
  }) => {
    await api.logProblem(data);
    const [h, l, s] = await Promise.all([
      api.getHeatmap(365),
      api.getRecentLogs(10),
      api.getUserStats(),
    ]);
    setHeatmapData(h);
    setRecentLogs(l);
    setStats(s);
    confetti({ particleCount: 35, spread: 45, origin: { y: 0.8 } });
  };

  const handleSaveFocus = async (priority: number, title: string) => {
    await api.setFocusSlot({ priority_order: priority, title });
    setFocusTasks(await api.getTodayFocus());
  };

  const handleToggleFocus = async (item: DailyFocus) => {
    const nextState = !item.is_completed;
    await api.updateFocusTask(item.id, { is_completed: nextState });
    const updated = await api.getTodayFocus();
    setFocusTasks(updated);
    setStats(await api.getUserStats());

    if (nextState && updated.filter((t) => t.is_completed).length === 3) {
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
    }
  };

  const handleDeleteFocus = async (id: number) => {
    await api.deleteFocusTask(id);
    setFocusTasks(await api.getTodayFocus());
  };

  const handlePromoteTaskToFocus = async (title: string) => {
    const occupiedSlots = new Set(focusTasks.map((t) => t.priority_order));
    let targetSlot = 1;
    for (let s = 1; s <= 3; s++) {
      if (!occupiedSlots.has(s)) {
        targetSlot = s;
        break;
      }
    }
    await api.setFocusSlot({ priority_order: targetSlot, title });
    setFocusTasks(await api.getTodayFocus());
    confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });
  };

  const handleToggleRoutine = async (id: number) => {
    await api.toggleRoutine(id);
    setRoutines(await api.getRoutines());
    setStats(await api.getUserStats());
  };

  const handleCreateRoutine = async (
    title: string,
    start: string,
    end: string,
    cat: string,
    scheduled_date?: string | null,
  ) => {
    await api.createRoutine({
      title,
      start_time: start,
      end_time: end,
      category: cat,
      scheduled_date: scheduled_date || null,
    });
    setRoutines(await api.getRoutines());
  };

  const handleUpdateRoutine = async (
    id: number,
    data: {
      title?: string;
      start_time?: string;
      end_time?: string;
      category?: string;
      scheduled_date?: string | null;
      is_completed_today?: boolean;
    },
  ) => {
    await api.updateRoutine(id, data);
    setRoutines(await api.getRoutines());
  };

  const handleDeleteRoutine = async (id: number) => {
    await api.deleteRoutine(id);
    setRoutines(await api.getRoutines());
    setStats(await api.getUserStats());
  };

  const handleUpdateLog = async (
    id: number,
    data: {
      problem_title?: string;
      platform?: string;
      difficulty?: string;
      topic_tag?: string;
    },
  ) => {
    await api.updateCodingLog(id, data);
    await loadDashboard();
  };

  const handleDeleteLog = async (id: number) => {
    await api.deleteCodingLog(id);
    await loadDashboard();
  };

  const totalSolved = heatmapData.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 pb-32">
      <Header
        stats={stats}
        onOpenPomodoro={() => {
          setActiveTab("focus");
          setIsPomodoroFullscreen(true);
        }}
        timerInfo={timerInfo}
      />

      {/* Desktop Navigation Tabs */}
      <div className="hidden md:flex items-center gap-2 mb-8 border-b border-border-subtle pb-3 overflow-x-auto scrollbar-none">
        {[
          { id: "arena", label: "Arena", icon: Terminal },
          { id: "focus", label: "Focus", icon: Timer },
          { id: "tasks", label: "Plan", icon: CheckSquare },
          { id: "stats", label: "Statistics", icon: Award },
          { id: "settings", label: "Settings", icon: SettingsIcon },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as NavTab)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono transition cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-surface-elevated text-accent font-bold border border-border-subtle shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Dynamic Views */}
      <div className="space-y-6">
        {/* VIEW 1: THE ARENA */}
        <div
          className={
            activeTab === "arena"
              ? "grid grid-cols-1 lg:grid-cols-12 gap-8"
              : "hidden"
          }
        >
          <div className="lg:col-span-7 space-y-6">
            <Heatmap data={heatmapData} />
            <ProblemLogger onLog={handleLogProblem} />
          </div>
          <div className="lg:col-span-5">
            <RecentLogs
              logs={recentLogs}
              onUpdateLog={handleUpdateLog}
              onDeleteLog={handleDeleteLog}
              onRefresh={loadDashboard}
            />
          </div>
        </div>

        {/* VIEW 2: DEDICATED FOCUS ENGINE */}
        <div
          className={
            activeTab === "focus"
              ? "space-y-6 max-w-4xl mx-auto"
              : isPomodoroFullscreen
                ? "block"
                : "hidden"
          }
        >
          <PomodoroTimer
            onSessionComplete={handleSessionComplete}
            isFullscreen={isPomodoroFullscreen}
            onToggleFullscreen={setIsPomodoroFullscreen}
            onTimerUpdate={setTimerInfo}
            showInline={true}
          />

          {activeTab === "focus" && (
            <div className="bg-surface border border-border-subtle rounded-2xl p-5 font-mono text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-accent-subtle border border-accent text-accent rounded-xl shrink-0">
                  <Timer className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-foreground font-bold block">
                    Deep Work Flow State & Focus Audio
                  </span>
                  <span className="text-[11px] text-subtle-foreground">
                    Use{" "}
                    <kbd className="px-1.5 py-0.5 bg-surface-muted border border-border-subtle rounded text-foreground">
                      Space
                    </kbd>{" "}
                    to toggle,{" "}
                    <kbd className="px-1.5 py-0.5 bg-surface-muted border border-border-subtle rounded text-foreground">
                      M
                    </kbd>{" "}
                    for Focus Audio, and{" "}
                    <kbd className="px-1.5 py-0.5 bg-surface-muted border border-border-subtle rounded text-foreground">
                      F
                    </kbd>{" "}
                    for Zen Fullscreen
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsPomodoroFullscreen(true)}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-foreground font-bold rounded-xl transition cursor-pointer shrink-0 shadow-xs"
              >
                Zen Fullscreen
              </button>
            </div>
          )}
        </div>

        {/* VIEW 3: UNIFIED PLAN HUB (Date Selector + Rule-of-3 + Timetable Schedule + Task Backlog + Daily Notes) */}
        <div
          className={
            activeTab === "tasks" ? "space-y-6 max-w-7xl mx-auto" : "hidden"
          }
        >
          {/* Plan Hub Shared Date Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-surface-elevated border border-border-subtle rounded-2xl shadow-xs font-mono">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const d = parseLocalDateString(selectedDate);
                  d.setDate(d.getDate() - 1);
                  setSelectedDate(getLocalDateString(d));
                }}
                className="p-1.5 rounded-xl hover:bg-surface-hover text-muted-foreground hover:text-foreground transition cursor-pointer"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-accent" />
                <span className="text-sm font-bold text-foreground">
                  {formatDisplayDate(selectedDate)}
                </span>
                <span className="text-xs text-subtle-foreground font-mono">
                  ({selectedDate})
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  const d = parseLocalDateString(selectedDate);
                  d.setDate(d.getDate() + 1);
                  setSelectedDate(getLocalDateString(d));
                }}
                className="p-1.5 rounded-xl hover:bg-surface-hover text-muted-foreground hover:text-foreground transition cursor-pointer"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {selectedDate !== getLocalDateString() && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(getLocalDateString())}
                  className="px-2.5 py-1 text-xs rounded-lg bg-surface-muted hover:bg-surface-hover text-muted-foreground hover:text-foreground transition cursor-pointer"
                >
                  Today
                </button>
              )}

              <CalendarPicker
                value={selectedDate}
                onChange={setSelectedDate}
                placeholder="Jump to date"
              />
            </div>
          </div>

          {/* Top Mission: Rule-of-3 Daily Focus */}
          <FocusSection
            tasks={focusTasks}
            onSave={handleSaveFocus}
            onToggle={handleToggleFocus}
            onDelete={handleDeleteFocus}
          />

          {/* Symmetrical 2-Column Desktop Grid / Stacked Phone Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <RoutineSection
              routines={routines}
              onToggle={handleToggleRoutine}
              onCreate={handleCreateRoutine}
              onUpdate={handleUpdateRoutine}
              onDelete={handleDeleteRoutine}
              selectedDate={selectedDate}
            />
            <TasksAndNotes
              onPromoteToFocus={handlePromoteTaskToFocus}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          </div>
        </div>

        {/* VIEW 4: STATISTICS & BADGES */}
        <div className={activeTab === "stats" ? "max-w-5xl mx-auto" : "hidden"}>
          <AchievementsView
            stats={stats}
            totalSolved={totalSolved}
            onRefreshDashboard={loadDashboard}
          />
        </div>

        {/* VIEW 5: SETTINGS & DRIVE CLOUD VAULT */}
        <div
          className={activeTab === "settings" ? "max-w-2xl mx-auto" : "hidden"}
        >
          <SettingsView onResetComplete={loadDashboard} />
        </div>
      </div>

      {/* Mobile Bottom Navigation for PWA */}
      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  );
}
