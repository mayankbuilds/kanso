"use client";

import Image from "next/image";
import { Flame, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { UserStats } from "@/types";
import { applyTheme, getInitialTheme } from "@/lib/theme";

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
    <header className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-8 border-b border-border-subtle gap-4 transition-colors">
      <div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden border border-border-subtle bg-surface shadow-xs shrink-0 flex items-center justify-center">
            <Image
              src="/apple-touch-icon.png"
              alt="Kanso Emblem"
              width={36}
              height={36}
              priority
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Kanso
            </h1>
            <p className="text-xs text-muted-foreground">
              Daily Focus • Practice Arena • Mindful Progress
            </p>
          </div>
        </div>
      </div>

      {/* Understated Gamification & Stats Widget */}
      <div className="flex items-center gap-2.5 self-start sm:self-auto bg-surface border border-border-subtle p-2 rounded-2xl shadow-xs">
        {/* Level & XP */}
        <div className="flex items-center gap-2 px-2.5 py-1 pr-3 border-r border-border-subtle">
          <div className="px-2 py-0.5 rounded-md bg-surface-muted border border-border-subtle font-mono font-semibold text-foreground text-xs">
            L{level}
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-muted-foreground">
              <span>{xp % 300}/300 XP</span>
            </div>
            <div className="w-20 h-1.5 bg-surface-muted rounded-full overflow-hidden mt-0.5">
              <div
                className="h-full bg-accent transition-all duration-500 rounded-full"
                style={{ width: `${progressInLevel}%` }}
              />
            </div>
          </div>
        </div>

        {/* Streak Milestone */}
        <div className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 bg-surface-muted border border-border-subtle rounded-xl text-foreground">
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
                : "bg-transparent hover:bg-surface-hover border-border-subtle text-muted-foreground hover:text-foreground"
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
