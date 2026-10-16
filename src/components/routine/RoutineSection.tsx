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
  selectedDate?: string;
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
  selectedDate,
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
    const targetDate = selectedDate || getTodayDateStr();
    return sortedRoutines.filter(
      (r) => !r.scheduled_date || r.scheduled_date === targetDate,
    );
  }, [sortedRoutines, selectedDate]);

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
    <div className="bg-surface-elevated border border-border-subtle rounded-2xl p-5 sm:p-6 flex flex-col h-full space-y-4 font-mono">
      {/* Top Header & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-accent" />
          <h3 className="text-xs uppercase tracking-wider text-foreground font-bold">
            Execution Timetable
          </h3>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-surface-muted p-1 rounded-xl border border-border-subtle text-xs self-start sm:self-auto">
          <button
            onClick={() => setActiveView("daily")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition cursor-pointer text-xs ${
              activeView === "daily"
                ? "bg-surface-elevated text-accent font-bold border border-border-subtle shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Daily ({dailyRoutines.length})</span>
          </button>

          <button
            onClick={() => setActiveView("upcoming")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition cursor-pointer text-xs ${
              activeView === "upcoming"
                ? "bg-surface-elevated text-accent font-bold border border-border-subtle shadow-xs"
                : "text-muted-foreground hover:text-foreground"
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
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface-muted hover:bg-surface-hover border border-border-subtle text-xs text-foreground transition cursor-pointer"
            title="Arrange schedule by time (Toggle Sort Order)"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-accent" />
            <span>{sortByTimeAsc ? "00-24" : "24-00"}</span>
          </button>

          {/* Manage categories button */}
          <button
            onClick={() => setShowCategoryManager(true)}
            className="p-1.5 rounded-xl bg-surface-muted hover:bg-surface-hover border border-border-subtle text-muted-foreground hover:text-foreground transition cursor-pointer"
            title="Manage Categories"
          >
            <Tag className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Add Block */}
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-accent hover:bg-accent-hover text-accent-foreground text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>{showAdd ? "Cancel" : "Add Routine"}</span>
        </button>
      </div>

      {/* PROGRESS BAR FOR DAILY ROUTINE */}
      {activeView === "daily" && dailyRoutines.length > 0 && (
        <div className="bg-surface-muted border border-border-subtle rounded-xl p-3 space-y-1.5">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Daily Execution Progress</span>
            <span className="text-accent font-bold">
              {completedCount} / {dailyRoutines.length} ({progressPct}%)
            </span>
          </div>
          <div className="h-2 w-full bg-surface-muted rounded-full overflow-hidden border border-border-subtle">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* ADD BLOCK FORM */}
      {showAdd && (
        <form
          onSubmit={handleCreate}
          className="bg-surface border border-border-subtle p-4 rounded-2xl space-y-3 animate-in fade-in"
        >
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle text-xs">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-accent" /> New Timetable Entry
            </span>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-[10px] text-muted-foreground mb-1 uppercase">
              Block Title
            </label>
            <input
              type="text"
              placeholder="e.g. LeetCode Graph Theory / OS Midterm Prep"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-surface-muted border border-border-subtle px-3 py-2 text-xs rounded-xl text-foreground focus:outline-none focus:border-accent"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1 uppercase">
                Start Time
              </label>
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full bg-surface-muted border border-border-subtle px-3 py-2 text-xs rounded-xl text-foreground focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1 uppercase">
                End Time
              </label>
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full bg-surface-muted border border-border-subtle px-3 py-2 text-xs rounded-xl text-foreground focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-muted-foreground mb-1 uppercase">
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
                      ? "bg-accent-subtle border-accent text-accent font-semibold"
                      : "bg-surface-muted border-border-subtle text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Date Option for specific one-off event */}
          <div className="pt-2 border-t border-border-subtle space-y-2">
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
                className="rounded accent-accent cursor-pointer"
              />
              <label
                htmlFor="isDatedCheck"
                className="text-xs text-foreground flex items-center gap-1.5 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-accent" />
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
            className="w-full bg-accent hover:bg-accent-hover text-accent-foreground text-xs font-medium py-2.5 rounded-xl transition cursor-pointer"
          >
            Save Timetable Block
          </button>
        </form>
      )}

      {/* VIEW 1: DAILY ROUTINE BLOCKS */}
      {activeView === "daily" && (
        <div className="space-y-2.5 max-h-[540px] overflow-y-auto scrollbar-none pr-1">
          {dailyRoutines.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border-subtle rounded-2xl">
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
                    className="p-4 bg-surface border border-border-subtle rounded-2xl space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-accent">
                      <span>Edit Timetable Block</span>
                      <button
                        onClick={cancelEdit}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-surface-muted border border-border-subtle px-3 py-1.5 text-xs rounded-xl text-foreground outline-none focus:border-accent"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="time"
                        value={editStart}
                        onChange={(e) => setEditStart(e.target.value)}
                        className="bg-surface-muted border border-border-subtle px-2 py-1 text-xs rounded-xl text-foreground"
                      />
                      <input
                        type="time"
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.target.value)}
                        className="bg-surface-muted border border-border-subtle px-2 py-1 text-xs rounded-xl text-foreground"
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
                              ? "bg-accent-subtle text-accent border-accent font-semibold"
                              : "bg-surface-muted text-muted-foreground border-border-subtle hover:text-foreground"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                      <button
                        onClick={() => handleDeleteBlock(r.id)}
                        className="text-xs text-rose-500 hover:text-rose-400 flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1 rounded-xl bg-surface-muted hover:bg-surface-hover text-muted-foreground hover:text-foreground text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          className="px-3.5 py-1 rounded-xl bg-accent hover:bg-accent-hover text-accent-foreground font-medium text-xs shadow-xs"
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
                      ? "bg-surface-muted/40 border-border-subtle opacity-50"
                      : isNow
                        ? "bg-accent-subtle border-accent"
                        : "bg-surface hover:bg-surface-hover border-border-subtle"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <button
                      onClick={() => onToggle(r.id)}
                      className="cursor-pointer text-muted-foreground hover:text-accent transition shrink-0"
                    >
                      {r.is_completed_today ? (
                        <CheckCircle className="w-5 h-5 text-accent" />
                      ) : (
                        <Circle className="w-5 h-5 hover:border-accent" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4
                          className={`text-xs font-bold truncate ${
                            r.is_completed_today
                              ? "line-through text-muted-foreground"
                              : "text-foreground"
                          }`}
                        >
                          {r.title}
                        </h4>
                        {isNow && (
                          <span className="px-1.5 py-0.2 rounded bg-accent text-accent-foreground text-[9px] font-bold uppercase tracking-wider animate-pulse">
                            NOW
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        <span className="font-mono text-muted-foreground">
                          {r.start_time} - {r.end_time}
                        </span>
                        <span>•</span>
                        <span className="px-1.5 py-0.2 bg-surface-muted rounded border border-border-subtle text-muted-foreground">
                          {r.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(r)}
                      className="p-1.5 rounded-lg bg-surface-muted hover:bg-surface-hover text-muted-foreground hover:text-foreground transition cursor-pointer"
                      title="Edit Block"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteBlock(r.id)}
                      className="p-1.5 rounded-lg bg-surface-muted hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition cursor-pointer"
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
            <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border-subtle rounded-2xl">
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
                      ? "bg-surface-muted/40 border-border-subtle opacity-50"
                      : isToday
                        ? "bg-accent-subtle border-accent/70 shadow-xs"
                        : "bg-surface border-border-subtle"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 pr-2">
                    <button
                      onClick={() => onToggle(evt.id)}
                      className="cursor-pointer text-muted-foreground hover:text-accent transition shrink-0 mt-0.5"
                    >
                      {evt.is_completed_today ? (
                        <CheckCircle className="w-5 h-5 text-accent" />
                      ) : (
                        <Circle className="w-5 h-5 hover:border-accent" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            isToday
                              ? "bg-accent-subtle text-accent border border-accent/40 font-semibold"
                              : "bg-surface-muted text-foreground border border-border-subtle"
                          }`}
                        >
                          {formatDateBadge(evt.scheduled_date!)}
                        </span>
                        <h4
                          className={`text-xs font-bold ${
                            evt.is_completed_today
                              ? "line-through text-muted-foreground"
                              : "text-foreground"
                          }`}
                        >
                          {evt.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                        <span className="font-mono text-muted-foreground">
                          {evt.start_time} - {evt.end_time}
                        </span>
                        <span>•</span>
                        <span className="px-1.5 py-0.2 bg-surface-muted rounded border border-border-subtle text-muted-foreground">
                          {evt.category}
                        </span>
                        <span>•</span>
                        <span className="text-muted-foreground">
                          {evt.scheduled_date}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => startEdit(evt)}
                      className="p-1.5 rounded-lg bg-surface-muted hover:bg-surface-hover text-muted-foreground hover:text-foreground transition cursor-pointer"
                      title="Edit Event"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteBlock(evt.id)}
                      className="p-1.5 rounded-lg bg-surface-muted hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition cursor-pointer"
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
          <div className="bg-surface border border-border-subtle w-full max-w-md rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <span className="text-sm font-bold text-foreground flex items-center gap-2">
                <Tag className="w-4 h-4 text-accent" /> Category Manager
              </span>
              <button
                onClick={() => setShowCategoryManager(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Add Category */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground uppercase">
                Create New Category
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. System Design, Gym"
                  value={newCatInput}
                  onChange={(e) => setNewCatInput(e.target.value)}
                  className="flex-1 bg-surface-muted border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={!newCatInput.trim()}
                  className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-accent-foreground font-medium text-xs rounded-xl transition disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Existing Categories List */}
            <div className="space-y-1.5 pt-2 border-t border-border-subtle">
              <span className="text-[11px] text-muted-foreground uppercase block">
                Existing Categories
              </span>
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {categories.map((category) => {
                  const isEditingThis = editingCategoryName === category;

                  if (isEditingThis) {
                    return (
                      <div
                        key={category}
                        className="flex items-center gap-2 p-2 rounded-xl bg-surface-muted border border-accent/40"
                      >
                        <input
                          type="text"
                          value={renamedCategoryInput}
                          onChange={(e) =>
                            setRenamedCategoryInput(e.target.value)
                          }
                          className="flex-1 bg-surface border border-border-subtle px-2 py-1 text-xs rounded text-foreground"
                        />
                        <button
                          onClick={() => handleRenameCategory(category)}
                          className="px-2 py-1 bg-accent text-accent-foreground font-medium text-[10px] rounded"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingCategoryName(null)}
                          className="text-muted-foreground text-[10px]"
                        >
                          Cancel
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={category}
                      className="flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border-subtle text-xs text-foreground"
                    >
                      <span className="font-bold">{category}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingCategoryName(category);
                            setRenamedCategoryInput(category);
                          }}
                          className="p-1 rounded bg-surface hover:bg-surface-hover text-muted-foreground hover:text-foreground"
                          title="Rename Category"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category)}
                          disabled={categories.length <= 1}
                          className="p-1 rounded bg-surface hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 disabled:opacity-30"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-border-subtle flex justify-end">
              <button
                onClick={() => setShowCategoryManager(false)}
                className="px-4 py-2 rounded-xl bg-surface-muted hover:bg-surface-hover text-foreground text-xs transition"
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
