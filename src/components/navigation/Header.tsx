"use client";

import { Flame, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { UserStats } from "@/types";
import { applyTheme, getInitialTheme, AccentColor, ThemeMode } from "@/lib/theme";

interface HeaderProps {
  stats: UserStats | null;
  onOpenPomodoro?: () => void;
  timerInfo?: {
    timeLeft: number;
    isRunning: boolean;
    mode: string;
  };
}

export default function Header({
  stats,
  onOpenPomodoro,
  timerInfo,
}: HeaderProps) {
  const [, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const init = getInitialTheme();
    applyTheme(init.mode, init.accent);

    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ mode?: ThemeMode; accent?: AccentColor }>;
      if (custom.detail) {
        const cur = getInitialTheme();
        applyTheme(custom.detail.mode || cur.mode, custom.detail.accent || cur.accent);
      }
    };
    window.addEventListener("kanso-theme-changed", handler);
    window.addEventListener("streakflow-theme-changed", handler);
    return () => {
      window.removeEventListener("kanso-theme-changed", handler);
      window.removeEventListener("streakflow-theme-changed", handler);
    };
  }, []);

  const xp = stats?.xp ?? 100;
  const level = stats?.level ?? 1;
  const streakDays = stats?.current_streak_days ?? 0;
  const progressInLevel = Math.round(((xp % 300) / 300) * 100);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-8 border-b border-zinc-200 dark:border-zinc-800 gap-4 transition-colors">
      <div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-accent text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-xs">
            K
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Kanso
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Daily Focus • Practice Arena • Mindful Progress
            </p>
          </div>
        </div>
      </div>

      {/* Understated Gamification & Stats Widget */}
      <div className="flex items-center gap-2.5 self-start sm:self-auto bg-white/70 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-2 rounded-2xl shadow-xs backdrop-blur-xs">
        {/* Level & XP */}
        <div className="flex items-center gap-2 px-2.5 py-1 pr-3 border-r border-zinc-200 dark:border-zinc-800">
          <div className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono font-semibold text-zinc-800 dark:text-zinc-200 text-xs">
            L{level}
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
              <span>{xp % 300}/300 XP</span>
            </div>
            <div className="w-20 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden mt-0.5">
              <div
                className="h-full bg-accent transition-all duration-500 rounded-full"
                style={{ width: `${progressInLevel}%` }}
              />
            </div>
          </div>
        </div>

        {/* Streak Milestone */}
        <div className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-zinc-700 dark:text-zinc-300">
          <Flame className="w-3.5 h-3.5 text-accent" />
          <span className="font-semibold">{streakDays}d Streak</span>
        </div>

        {/* Focus Timer Trigger */}
        {onOpenPomodoro && (
          <button
            type="button"
            onClick={onOpenPomodoro}
            className={`flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
              timerInfo?.isRunning
                ? "bg-accent-subtle border-accent text-accent font-semibold"
                : "bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
            title="Open Focus Timer (F)"
          >
            {timerInfo?.isRunning ? (
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            ) : (
              <Timer className="w-3.5 h-3.5" />
            )}
            <span className="font-medium">
              {timerInfo
                ? timerInfo.isRunning
                  ? `${formatTimer(timerInfo.timeLeft)}`
                  : timerInfo.timeLeft < 1500
                    ? `${formatTimer(timerInfo.timeLeft)} (Paused)`
                    : "Focus Timer"
                : "Focus Timer"}
            </span>
          </button>
        )}
      </div>
    </header>
  );
}
