"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { getLocalDateString } from "@/lib/dateUtils";

interface CalendarPickerProps {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (dateStr: string) => void;
  placeholder?: string;
  className?: string;
  align?: "left" | "right";
  showQuickPresets?: boolean;
}

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function CalendarPicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className = "",
  align = "left",
  showQuickPresets = true,
}: CalendarPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial year/month from value or today
  const selectedDate = useMemo(() => {
    if (!value) return null;
    const parts = value.split("-").map(Number);
    if (
      parts.length === 3 &&
      !isNaN(parts[0]) &&
      !isNaN(parts[1]) &&
      !isNaN(parts[2])
    ) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return null;
  }, [value]);

  const [currentYear, setCurrentYear] = useState(() =>
    selectedDate ? selectedDate.getFullYear() : new Date().getFullYear(),
  );
  const [currentMonth, setCurrentMonth] = useState(() =>
    selectedDate ? selectedDate.getMonth() : new Date().getMonth(),
  );

  // Sync view when selectedDate changes from outside
  const [prevDateStr, setPrevDateStr] = useState(
    selectedDate ? getLocalDateString(selectedDate) : "",
  );
  const currentDateStr = selectedDate
    ? getLocalDateString(selectedDate)
    : "";
  if (currentDateStr !== prevDateStr) {
    setPrevDateStr(currentDateStr);
    if (selectedDate) {
      setCurrentYear(selectedDate.getFullYear());
      setCurrentMonth(selectedDate.getMonth());
    }
  }

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Format Helper
  const toDateString = (year: number, month: number, day: number) => {
    const y = year.toString().padStart(4, "0");
    const m = (month + 1).toString().padStart(2, "0");
    const d = day.toString().padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const todayStr = useMemo(() => {
    const today = new Date();
    return toDateString(today.getFullYear(), today.getMonth(), today.getDate());
  }, []);

  const displayLabel = useMemo(() => {
    if (!value) return placeholder;
    if (value === todayStr) return "Today";
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = toDateString(
      tomorrow.getFullYear(),
      tomorrow.getMonth(),
      tomorrow.getDate(),
    );
    if (value === tomorrowStr) return "Tomorrow";

    if (selectedDate) {
      return selectedDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year:
          selectedDate.getFullYear() !== new Date().getFullYear()
            ? "numeric"
            : undefined,
      });
    }
    return value;
  }, [value, todayStr, selectedDate, placeholder]);

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  // Build calendar matrix days
  const calendarDays = useMemo(() => {
    const days = [];
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    // Previous month padding days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      days.push({
        day: dayNum,
        month: prevMonth,
        year: prevYear,
        isCurrentMonth: false,
        dateStr: toDateString(prevYear, prevMonth, dayNum),
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        day: d,
        month: currentMonth,
        year: currentYear,
        isCurrentMonth: true,
        dateStr: toDateString(currentYear, currentMonth, d),
      });
    }

    // Next month padding days to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      days.push({
        day: d,
        month: nextMonth,
        year: nextYear,
        isCurrentMonth: false,
        dateStr: toDateString(nextYear, nextMonth, d),
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  const handleSelectDay = (dateStr: string) => {
    onChange(dateStr);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-mono transition cursor-pointer ${
            value
              ? "bg-zinc-900 border-zinc-700 text-zinc-100 hover:border-emerald-500"
              : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
          }`}
        >
          <CalendarIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span>{displayLabel}</span>
        </button>

        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            title="Clear date"
            className="p-1 text-zinc-500 hover:text-rose-400 transition cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Calendar Popover */}
      {isOpen && (
        <div
          className={`absolute top-full mt-1.5 z-50 w-64 bg-zinc-950 border border-zinc-800/90 rounded-2xl p-3 shadow-2xl backdrop-blur-xl font-mono text-xs animate-in fade-in zoom-in-95 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {/* Header Month / Year & Arrows */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-900">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="font-bold text-zinc-100">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-zinc-500 font-bold mb-1">
            {DAYS_OF_WEEK.map((w) => (
              <div key={w} className="py-0.5">
                {w}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarDays.map((cell) => {
              const isSelected = value === cell.dateStr;
              const isToday = todayStr === cell.dateStr;

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => handleSelectDay(cell.dateStr)}
                  className={`h-7 w-7 mx-auto rounded-lg text-xs flex items-center justify-center transition cursor-pointer ${
                    isSelected
                      ? "bg-emerald-500 text-black font-bold shadow-md shadow-emerald-500/30"
                      : isToday
                        ? "bg-zinc-900 border border-emerald-500/60 text-emerald-400 font-bold"
                        : cell.isCurrentMonth
                          ? "text-zinc-200 hover:bg-zinc-900 hover:text-white"
                          : "text-zinc-600 hover:bg-zinc-900/50 hover:text-zinc-400"
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Quick Presets */}
          {showQuickPresets && (
            <div className="mt-3 pt-2 border-t border-zinc-900 flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSelectDay(todayStr)}
                  className="px-2 py-0.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tmrw = new Date();
                    tmrw.setDate(tmrw.getDate() + 1);
                    handleSelectDay(
                      toDateString(
                        tmrw.getFullYear(),
                        tmrw.getMonth(),
                        tmrw.getDate(),
                      ),
                    );
                  }}
                  className="px-2 py-0.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer"
                >
                  Tomorrow
                </button>
              </div>

              {value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setIsOpen(false);
                  }}
                  className="text-zinc-500 hover:text-rose-400 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
