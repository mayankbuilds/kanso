"use client";

import { useMemo, useState, useEffect } from "react";
import { LayoutGrid, BarChart3, TrendingUp } from "lucide-react";
import { HeatmapDay } from "@/types";

interface HeatmapProps {
  data: HeatmapDay[];
  onSelectDate?: (date: string, count: number) => void;
}

export default function Heatmap({ data, onSelectDate }: HeatmapProps) {
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<"matrix" | "chart">("matrix");
  const [timeframe, setTimeframe] = useState<"16w" | "26w" | "52w">("52w");
  const [hoveredDay, setHoveredDay] = useState<{
    date: string;
    count: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const countMap = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((d) => {
      map[d.date] = d.count;
    });
    return map;
  }, [data]);

  const totalDays = useMemo(() => {
    if (timeframe === "16w") return 112;
    if (timeframe === "26w") return 182;
    return 364; // 52 weeks (1 full year)
  }, [timeframe]);

  const days = useMemo(() => {
    if (!mounted) return [];
    const arr = [];
    const today = new Date();
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      arr.push({
        date: iso,
        count: countMap[iso] || 0,
      });
    }
    return arr;
  }, [countMap, mounted, totalDays]);

  // Last 14 days for the Velocity Chart
  const last14Days = useMemo(() => {
    if (!mounted) return [];
    const arr = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      arr.push({
        date: iso,
        dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
        shortDate: iso.slice(5),
        count: countMap[iso] || 0,
      });
    }
    return arr;
  }, [countMap, mounted]);

  const maxChartCount = useMemo(() => {
    const maxVal = Math.max(...last14Days.map((d) => d.count), 0);
    return Math.max(maxVal, 4);
  }, [last14Days]);

  const totalSolved = useMemo(() => {
    return data.reduce((acc, curr) => acc + curr.count, 0);
  }, [data]);

  const last14Total = useMemo(() => {
    return last14Days.reduce((acc, d) => acc + d.count, 0);
  }, [last14Days]);

  const getColor = (count: number) => {
    if (count === 0)
      return "bg-surface-muted border-border-subtle hover:border-border-strong";
    if (count === 1)
      return "bg-accent/30 border-accent/40 text-foreground hover:brightness-125";
    if (count <= 3)
      return "bg-accent/65 border-accent/70 text-foreground hover:brightness-125";
    return "bg-accent border-accent text-accent-foreground font-medium hover:brightness-110";
  };

  return (
    <div className="bg-surface border border-border-subtle rounded-2xl p-5 relative font-mono">
      {/* Header with View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {viewMode === "matrix"
                ? "Execution Matrix"
                : "Problem Velocity Chart"}
            </h3>
            <span className="text-[10px] text-accent bg-accent-subtle border border-accent/30 px-2 py-0.5 rounded-full font-medium">
              {viewMode === "matrix"
                ? timeframe === "16w"
                  ? "16-Week Ledger"
                  : timeframe === "26w"
                    ? "26-Week Ledger (6M)"
                    : "52-Week Ledger (1 Year)"
                : "14-Day Velocity"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {hoveredDay ? (
              <span className="text-accent font-medium">
                {hoveredDay.date}: {hoveredDay.count} problem
                {hoveredDay.count !== 1 ? "s" : ""} solved
              </span>
            ) : viewMode === "matrix" ? (
              timeframe === "52w" ? (
                "Full year (52 weeks) of coding consistency"
              ) : timeframe === "26w" ? (
                "Last 26 weeks (6 months) of consistency"
              ) : (
                "Last 16 weeks of coding consistency"
              )
            ) : (
              `Recent velocity: ${last14Total} solved across last 14 days`
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Timeframe Range Selector (Matrix Mode) */}
          {viewMode === "matrix" && (
            <div className="flex items-center bg-surface-muted p-1 rounded-xl border border-border-subtle text-[11px]">
              <button
                type="button"
                onClick={() => setTimeframe("16w")}
                className={`px-2 py-0.5 rounded-lg transition cursor-pointer ${
                  timeframe === "16w"
                    ? "bg-surface-elevated text-accent font-medium border border-border-subtle shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="16 Weeks (~4 Months)"
              >
                16W
              </button>
              <button
                type="button"
                onClick={() => setTimeframe("26w")}
                className={`px-2 py-0.5 rounded-lg transition cursor-pointer ${
                  timeframe === "26w"
                    ? "bg-surface-elevated text-accent font-medium border border-border-subtle shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="26 Weeks (6 Months)"
              >
                26W
              </button>
              <button
                type="button"
                onClick={() => setTimeframe("52w")}
                className={`px-2 py-0.5 rounded-lg transition cursor-pointer ${
                  timeframe === "52w"
                    ? "bg-surface-elevated text-accent font-medium border border-border-subtle shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="52 Weeks (1 Full Year)"
              >
                52W (1Y)
              </button>
            </div>
          )}

          {/* View Mode Toggle Buttons */}
          <div className="flex items-center bg-surface-muted p-1 rounded-xl border border-border-subtle text-xs">
            <button
              onClick={() => setViewMode("matrix")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition cursor-pointer ${
                viewMode === "matrix"
                  ? "bg-surface-elevated text-accent font-medium border border-border-subtle shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Matrix View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Matrix</span>
            </button>
            <button
              onClick={() => setViewMode("chart")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition cursor-pointer ${
                viewMode === "chart"
                  ? "bg-surface-elevated text-accent font-medium border border-border-subtle shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Velocity Chart View"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Chart</span>
            </button>
          </div>

          <div className="flex items-baseline gap-1.5 pl-2 border-l border-border-subtle">
            <span className="text-2xl font-bold text-foreground">
              {totalSolved}
            </span>
            <span className="text-xs text-muted-foreground">solved</span>
          </div>
        </div>
      </div>

      {/* VIEW 1: MATRIX VIEW */}
      {viewMode === "matrix" && (
        <>
          <div className="overflow-x-auto px-2 py-2 -mx-2 scrollbar-thin scrollbar-thumb-border-subtle">
            <div className="grid grid-flow-col grid-rows-7 gap-1.5 min-w-max pr-3 py-1">
              {mounted &&
                days.map((d) => (
                  <button
                    key={d.date}
                    type="button"
                    onMouseEnter={() => setHoveredDay(d)}
                    onMouseLeave={() => setHoveredDay(null)}
                    onClick={() =>
                      onSelectDate && onSelectDate(d.date, d.count)
                    }
                    className={`w-3.5 h-3.5 rounded-sm border transition-all transform active:scale-95 hover:scale-125 cursor-pointer ${getColor(
                      d.count,
                    )}`}
                  />
                ))}
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 text-[11px] text-muted-foreground">
            <span>
              {timeframe === "16w"
                ? "16 weeks ago"
                : timeframe === "26w"
                  ? "26 weeks (6 months) ago"
                  : "52 weeks (1 full year) ago"}
            </span>
            <div className="flex items-center gap-1.5">
              <span>Less</span>
              <div className="w-2.5 h-2.5 rounded-sm bg-surface-muted border border-border-subtle" />
              <div className="w-2.5 h-2.5 rounded-sm bg-accent/30 border border-accent/40" />
              <div className="w-2.5 h-2.5 rounded-sm bg-accent/65 border border-accent/70" />
              <div className="w-2.5 h-2.5 rounded-sm bg-accent" />
              <span>More</span>
            </div>
            <span>Today</span>
          </div>
        </>
      )}

      {/* VIEW 2: VELOCITY CHART VIEW */}
      {viewMode === "chart" && (
        <div className="space-y-4 pt-1">
          {/* Quick Velocity KPI Pills */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-surface-muted border border-border-subtle p-2.5 rounded-xl">
              <span className="text-[10px] text-muted-foreground block">
                14-Day Solves
              </span>
              <span className="text-lg font-bold text-foreground">
                {last14Total}
              </span>
            </div>
            <div className="bg-surface-muted border border-border-subtle p-2.5 rounded-xl">
              <span className="text-[10px] text-muted-foreground block">
                Active Days
              </span>
              <span className="text-lg font-bold text-accent">
                {last14Days.filter((d) => d.count > 0).length}/14
              </span>
            </div>
            <div className="bg-surface-muted border border-border-subtle p-2.5 rounded-xl">
              <span className="text-[10px] text-muted-foreground block">
                Peak Solves / Day
              </span>
              <span className="text-lg font-bold text-foreground">
                {Math.max(...last14Days.map((d) => d.count), 0)}
              </span>
            </div>
          </div>

          {/* SVG Bar Chart */}
          <div className="h-44 w-full flex items-end justify-between gap-1.5 pt-4 px-1">
            {last14Days.map((d) => {
              const heightPct = Math.max(
                Math.round((d.count / maxChartCount) * 100),
                d.count > 0 ? 12 : 4,
              );
              return (
                <div
                  key={d.date}
                  className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                  onMouseEnter={() => setHoveredDay(d)}
                  onMouseLeave={() => setHoveredDay(null)}
                  onClick={() => onSelectDate && onSelectDate(d.date, d.count)}
                >
                  <span className="text-[10px] text-muted-foreground font-medium mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {d.count > 0 ? d.count : ""}
                  </span>
                  <div className="w-full max-w-[24px] bg-surface-muted rounded-t-lg overflow-hidden h-32 flex items-end">
                    <div
                      className={`w-full rounded-t-lg transition-all duration-500 ${
                        d.count > 0
                          ? "bg-accent group-hover:opacity-90 shadow-xs"
                          : "bg-surface-elevated"
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground mt-2 truncate max-w-[32px]">
                    {d.shortDate}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-2 border-t border-border-subtle">
            <span>Hover on bars for problem breakdown</span>
            <span className="text-accent flex items-center gap-1 font-medium">
              <TrendingUp className="w-3.5 h-3.5" /> High execution momentum
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
