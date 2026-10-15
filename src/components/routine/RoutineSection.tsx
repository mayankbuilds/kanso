"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Clock,
  Plus,
  CheckCircle,
  Circle,
  Edit3,
  Trash2,
  X,
  Calendar,
  ArrowUpDown,
  Tag,
  CalendarDays,
} from "lucide-react";
import { StudentRoutine } from "@/types";
import CalendarPicker from "@/components/ui/CalendarPicker";
import { getLocalDateString } from "@/lib/dateUtils";

interface RoutineSectionProps {
  routines: StudentRoutine[];
  onToggle: (id: number) => Promise<void>;
  onCreate: (
    title: string,
    start: string,
    end: string,
    cat: string,
    scheduled_date?: string | null,
  ) => Promise<void>;
  onUpdate?: (
    id: number,
    data: {
      title?: string;
      start_time?: string;
      end_time?: string;
      category?: string;
      scheduled_date?: string | null;
      is_completed_today?: boolean;
    },
  ) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
}

const DEFAULT_CATEGORIES = [
  "Coding",
  "College",
  "Workout",
  "Reading",
  "Revision",
  "Project",
  "Contest",
  "Exam",
];

export default function RoutineSection({
  routines,
  onToggle,
  onCreate,
  onUpdate,
  onDelete,
}: RoutineSectionProps) {
  const [nowStr, setNowStr] = useState("");
  const [activeView, setActiveView] = useState<"daily" | "upcoming">("daily");

  // Add Routine State
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("09:30");
  const [cat, setCat] = useState("Coding");
  const [isDated, setIsDated] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");

  // Edit Routine State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editCat, setEditCat] = useState("");
  const [editIsDated, setEditIsDated] = useState(false);
  const [editScheduledDate, setEditScheduledDate] = useState("");

  // Category Manager State
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCatInput, setNewCatInput] = useState("");
  const [editingCategoryName, setEditingCategoryName] = useState<string | null>(
    null,
  );
  const [renamedCategoryInput, setRenamedCategoryInput] = useState("");

  // Sorting order toggle
  const [sortByTimeAsc, setSortByTimeAsc] = useState(true);

  // Load custom categories from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("streakflow_custom_categories");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCategories(parsed);
          }
        } catch {}
      }
    }
  }, []);

  const saveCategories = (newList: string[]) => {
    setCategories(newList);
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "streakflow_custom_categories",
        JSON.stringify(newList),
      );
    }
  };

  const handleAddCategory = () => {
    const trimmed = newCatInput.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    const updated = [...categories, trimmed];
    saveCategories(updated);
    setNewCatInput("");
    setCat(trimmed);
  };

  const handleRenameCategory = (oldName: string) => {
    const trimmed = renamedCategoryInput.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingCategoryName(null);
      return;
    }
    const updated = categories.map((c) => (c === oldName ? trimmed : c));
    saveCategories(updated);
    setEditingCategoryName(null);
    setRenamedCategoryInput("");
    if (cat === oldName) setCat(trimmed);
  };

  const handleDeleteCategory = (catToDelete: string) => {
    if (categories.length <= 1) return;
    const updated = categories.filter((c) => c !== catToDelete);
    saveCategories(updated);
    if (cat === catToDelete) setCat(updated[0]);
  };

  // Real-time clock for block active detection
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      setNowStr(`${h}:${m}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const getTodayDateStr = () => {
    return getLocalDateString();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onCreate(
      title.trim(),
      start,
      end,
      cat,
      isDated && scheduledDate ? scheduledDate : null,
    );
    setTitle("");
    setShowAdd(false);
    setIsDated(false);
    setScheduledDate("");
  };

  const startEdit = (routine: StudentRoutine) => {
    setEditingId(routine.id);
    setEditTitle(routine.title);
    setEditStart(routine.start_time);
    setEditEnd(routine.end_time);
    setEditCat(routine.category);
    setEditIsDated(Boolean(routine.scheduled_date));
    setEditScheduledDate(routine.scheduled_date || getTodayDateStr());
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !onUpdate || !editTitle.trim()) return;
    await onUpdate(editingId, {
      title: editTitle.trim(),
      start_time: editStart,
      end_time: editEnd,
      category: editCat,
      scheduled_date:
        editIsDated && editScheduledDate ? editScheduledDate : null,
    });
    setEditingId(null);
  };

  const handleDeleteBlock = async (id: number) => {
    if (!onDelete) return;
    await onDelete(id);
  };

  // Format date helper: "Today", "Tomorrow", or "Sep 15"
  const formatDateBadge = (dateStr: string) => {
    const today = getTodayDateStr();
    if (dateStr === today) return "Today";
    const d = new Date(dateStr);
    const todayD = new Date(today);
    const diffTime = d.getTime() - todayD.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return "Tomorrow";
    if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
    return dateStr;
  };

  // Filter and arrange routines
  const sortedRoutines = useMemo(() => {
    return [...routines].sort((a, b) => {
      if (sortByTimeAsc) {
        return a.start_time.localeCompare(b.start_time);
      } else {
        return b.start_time.localeCompare(a.start_time);
      }
    });
  }, [routines, sortByTimeAsc]);

  // Daily recurring vs Date-specific events
  const dailyRoutines = useMemo(() => {
    const today = getTodayDateStr();
    return sortedRoutines.filter(
      (r) => !r.scheduled_date || r.scheduled_date === today,
    );
  }, [sortedRoutines]);

  const upcomingEvents = useMemo(() => {
    return sortedRoutines
      .filter((r) => Boolean(r.scheduled_date))
      .sort((a, b) => {
        const dateA = a.scheduled_date || "";
        const dateB = b.scheduled_date || "";
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return a.start_time.localeCompare(b.start_time);
      });
  }, [sortedRoutines]);

  const completedCount = dailyRoutines.filter(
    (r) => r.is_completed_today,
  ).length;
  const progressPct =
    dailyRoutines.length > 0
      ? Math.round((completedCount / dailyRoutines.length) * 100)
      : 0;

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 flex flex-col h-full space-y-4 font-mono">
      {/* Top Header & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs uppercase tracking-wider text-zinc-300 font-bold">
            Execution Timetable
          </h3>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs self-start sm:self-auto">
          <button
            onClick={() => setActiveView("daily")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition cursor-pointer text-xs ${
              activeView === "daily"
                ? "bg-zinc-800 text-emerald-400 font-bold border border-zinc-700 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Daily ({dailyRoutines.length})</span>
          </button>

          <button
            onClick={() => setActiveView("upcoming")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition cursor-pointer text-xs ${
              activeView === "upcoming"
                ? "bg-zinc-800 text-cyan-400 font-bold border border-zinc-700 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Agenda ({upcomingEvents.length})</span>
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Arrange by time button */}
          <button
            onClick={() => setSortByTimeAsc(!sortByTimeAsc)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 transition cursor-pointer"
            title="Arrange schedule by time (Toggle Sort Order)"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400" />
            <span>{sortByTimeAsc ? "00-24" : "24-00"}</span>
          </button>

          {/* Manage categories button */}
          <button
            onClick={() => setShowCategoryManager(true)}
            className="p-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
            title="Manage Categories"
          >
            <Tag className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Add Block */}
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-xl transition cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>{showAdd ? "Cancel" : "Add Routine"}</span>
        </button>
      </div>

      {/* PROGRESS BAR FOR DAILY ROUTINE */}
      {activeView === "daily" && dailyRoutines.length > 0 && (
        <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-xl p-3 space-y-1.5">
          <div className="flex justify-between text-[11px] text-zinc-400">
            <span>Daily Execution Progress</span>
            <span className="text-emerald-400 font-bold">
              {completedCount} / {dailyRoutines.length} ({progressPct}%)
            </span>
          </div>
          <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* ADD BLOCK FORM */}
      {showAdd && (
        <form
          onSubmit={handleCreate}
          className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl space-y-3 animate-in fade-in"
        >
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs">
            <span className="font-bold text-zinc-200 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-emerald-400" /> New Timetable Entry
            </span>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-[10px] text-zinc-400 mb-1 uppercase">
              Block Title
            </label>
            <input
              type="text"
              placeholder="e.g. LeetCode Graph Theory / OS Midterm Prep"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs rounded-xl text-zinc-100 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-zinc-400 mb-1 uppercase">
                Start Time
              </label>
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs rounded-xl text-zinc-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 mb-1 uppercase">
                End Time
              </label>
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs rounded-xl text-zinc-100 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-zinc-400 mb-1 uppercase">
              Category
            </label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCat(c)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer border ${
                    cat === c
                      ? "bg-emerald-950/80 border-emerald-500 text-emerald-400 font-bold"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Date Option for specific one-off event */}
          <div className="pt-2 border-t border-zinc-800/80 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDatedCheck"
                checked={isDated}
                onChange={(e) => {
                  setIsDated(e.target.checked);
                  if (e.target.checked && !scheduledDate) {
                    setScheduledDate(getTodayDateStr());
                  }
                }}
                className="rounded accent-emerald-400 cursor-pointer"
              />
              <label
                htmlFor="isDatedCheck"
                className="text-xs text-zinc-300 flex items-center gap-1.5 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                Schedule for specific date (Exam / Contest / Special Task)
              </label>
            </div>

            {isDated && (
              <div className="pl-6 pt-1">
                <CalendarPicker
                  value={scheduledDate}
                  onChange={setScheduledDate}
                  placeholder="Select block date..."
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold py-2.5 rounded-xl transition cursor-pointer"
          >
            Save Timetable Block
          </button>
        </form>
      )}

      {/* VIEW 1: DAILY ROUTINE BLOCKS */}
      {activeView === "daily" && (
        <div className="space-y-2.5 max-h-[540px] overflow-y-auto scrollbar-none pr-1">
          {dailyRoutines.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-600 border border-dashed border-zinc-800 rounded-2xl">
              No routine blocks added yet. Click &quot;+ Add&quot; to build your
              execution timetable!
            </div>
          ) : (
            dailyRoutines.map((r) => {
              const isNow =
                nowStr >= r.start_time &&
                nowStr < r.end_time &&
                !r.is_completed_today;
              const isEditing = editingId === r.id;

              if (isEditing) {
                return (
                  <div
                    key={r.id}
                    className="p-4 bg-zinc-900/90 border border-emerald-800/80 rounded-2xl space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                      <span>Edit Timetable Block</span>
                      <button
                        onClick={cancelEdit}
                        className="text-zinc-500 hover:text-zinc-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 px-3 py-1.5 text-xs rounded-xl text-white outline-none focus:border-emerald-500"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="time"
                        value={editStart}
                        onChange={(e) => setEditStart(e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 px-2 py-1 text-xs rounded-xl text-white"
                      />
                      <input
                        type="time"
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 px-2 py-1 text-xs rounded-xl text-white"
                      />
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {categories.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditCat(c)}
                          className={`px-2 py-0.5 rounded text-[11px] border ${
                            editCat === c
                              ? "bg-emerald-950 text-emerald-400 border-emerald-700 font-bold"
                              : "bg-zinc-950 text-zinc-400 border-zinc-800"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                      <button
                        onClick={() => handleDeleteBlock(r.id)}
                        className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1 rounded-xl bg-zinc-800 text-zinc-300 text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          className="px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={r.id}
                  className={`group p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                    r.is_completed_today
                      ? "bg-zinc-950/40 border-zinc-800/40 opacity-50"
                      : isNow
                        ? "bg-emerald-950/20 border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                        : "bg-zinc-900/30 hover:bg-zinc-900/60 border-zinc-800/70"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <button
                      onClick={() => onToggle(r.id)}
                      className="cursor-pointer text-zinc-500 hover:text-emerald-400 transition shrink-0"
                    >
                      {r.is_completed_today ? (
                        <CheckCircle className="w-5 h-5 text-emerald-400 fill-emerald-950" />
                      ) : (
                        <Circle className="w-5 h-5 hover:border-emerald-400" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4
                          className={`text-xs font-bold truncate ${
                            r.is_completed_today
                              ? "line-through text-zinc-500"
                              : "text-zinc-200"
                          }`}
                        >
                          {r.title}
                        </h4>
                        {isNow && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-black text-[9px] font-black uppercase tracking-wider animate-pulse">
                            NOW
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5">
                        <span className="font-mono text-zinc-400">
                          {r.start_time} - {r.end_time}
                        </span>
                        <span>•</span>
                        <span className="px-1.5 py-0.2 bg-zinc-950 rounded border border-zinc-800 text-zinc-400">
                          {r.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(r)}
                      className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
                      title="Edit Block"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteBlock(r.id)}
                      className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-rose-950 text-zinc-300 hover:text-rose-400 transition cursor-pointer"
                      title="Delete Block"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW 2: UPCOMING EVENTS & DATED AGENDA */}
      {activeView === "upcoming" && (
        <div className="space-y-2.5 max-h-[540px] overflow-y-auto scrollbar-none pr-1">
          {upcomingEvents.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-600 border border-dashed border-zinc-800 rounded-2xl">
              No dated upcoming events scheduled yet. When adding a routine
              block, check &quot;Schedule for specific date&quot; to track
              contests, exams, and project milestones!
            </div>
          ) : (
            upcomingEvents.map((evt) => {
              const isToday = evt.scheduled_date === getTodayDateStr();
              return (
                <div
                  key={evt.id}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                    evt.is_completed_today
                      ? "bg-zinc-950/40 border-zinc-800/40 opacity-50"
                      : isToday
                        ? "bg-cyan-950/20 border-cyan-500/80 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                        : "bg-zinc-900/30 border-zinc-800/80"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 pr-2">
                    <button
                      onClick={() => onToggle(evt.id)}
                      className="cursor-pointer text-zinc-500 hover:text-cyan-400 transition shrink-0 mt-0.5"
                    >
                      {evt.is_completed_today ? (
                        <CheckCircle className="w-5 h-5 text-cyan-400 fill-cyan-950" />
                      ) : (
                        <Circle className="w-5 h-5 hover:border-cyan-400" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            isToday
                              ? "bg-cyan-950 text-cyan-400 border border-cyan-800"
                              : "bg-zinc-800 text-zinc-300 border border-zinc-700"
                          }`}
                        >
                          {formatDateBadge(evt.scheduled_date!)}
                        </span>
                        <h4
                          className={`text-xs font-bold ${
                            evt.is_completed_today
                              ? "line-through text-zinc-500"
                              : "text-zinc-100"
                          }`}
                        >
                          {evt.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-1">
                        <span className="font-mono text-zinc-400">
                          {evt.start_time} - {evt.end_time}
                        </span>
                        <span>•</span>
                        <span className="px-1.5 py-0.2 bg-zinc-950 rounded border border-zinc-800 text-zinc-400">
                          {evt.category}
                        </span>
                        <span>•</span>
                        <span className="text-zinc-500">
                          {evt.scheduled_date}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => startEdit(evt)}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                      title="Edit Event"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteBlock(evt.id)}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950 text-zinc-300 hover:text-rose-400 transition"
                      title="Delete Event"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* CATEGORY MANAGER MODAL */}
      {showCategoryManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-400" /> Category Manager
              </span>
              <button
                onClick={() => setShowCategoryManager(false)}
                className="text-zinc-500 hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Add Category */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-zinc-400 uppercase">
                Create New Category
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. System Design, Gym"
                  value={newCatInput}
                  onChange={(e) => setNewCatInput(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100 outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={!newCatInput.trim()}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Existing Categories List */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
              <span className="text-[11px] text-zinc-400 uppercase block">
                Existing Categories
              </span>
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {categories.map((category) => {
                  const isEditingThis = editingCategoryName === category;

                  if (isEditingThis) {
                    return (
                      <div
                        key={category}
                        className="flex items-center gap-2 p-2 rounded-xl bg-zinc-900 border border-emerald-800"
                      >
                        <input
                          type="text"
                          value={renamedCategoryInput}
                          onChange={(e) =>
                            setRenamedCategoryInput(e.target.value)
                          }
                          className="flex-1 bg-zinc-950 border border-zinc-800 px-2 py-1 text-xs rounded text-white"
                        />
                        <button
                          onClick={() => handleRenameCategory(category)}
                          className="px-2 py-1 bg-emerald-500 text-black font-bold text-[10px] rounded"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingCategoryName(null)}
                          className="text-zinc-500 text-[10px]"
                        >
                          Cancel
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={category}
                      className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/70 text-xs text-zinc-300"
                    >
                      <span className="font-bold">{category}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingCategoryName(category);
                            setRenamedCategoryInput(category);
                          }}
                          className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                          title="Rename Category"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category)}
                          disabled={categories.length <= 1}
                          className="p-1 rounded bg-zinc-800 hover:bg-rose-950 text-zinc-400 hover:text-rose-400 disabled:opacity-30"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setShowCategoryManager(false)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
