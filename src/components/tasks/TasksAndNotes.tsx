"use client";

import { useState, useEffect, useMemo } from "react";
import {
  CheckSquare,
  FileText,
  Plus,
  Trash2,
  Pin,
  Search,
  Calendar,
  Copy,
  Check,
  Tag,
  ArrowUpRight,
  Edit3,
  X,
  CalendarDays,
} from "lucide-react";
import confetti from "canvas-confetti";
import CalendarPicker from "@/components/ui/CalendarPicker";
import MarkdownViewer from "@/components/ui/MarkdownViewer";
import {
  STORAGE_KEYS,
  getLocal,
  setLocal,
  recordUserActivity,
  getUserStats,
  setUserStats,
} from "@/lib/storage";
import { getLocalDateString, formatDisplayDate } from "@/lib/dateUtils";

export interface BacklogTask {
  id: string;
  title: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  dueDate?: string;
  isCompleted: boolean;
  createdAt: string;
}

export interface QuickNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  date?: string; // YYYY-MM-DD
  updatedAt: string;
}

interface TasksAndNotesProps {
  onPromoteToFocus?: (title: string) => Promise<void>;
  selectedDate?: string; // YYYY-MM-DD
  onSelectDate?: (dateStr: string) => void;
}

export default function TasksAndNotes({
  onPromoteToFocus,
  selectedDate,
  onSelectDate,
}: TasksAndNotesProps) {
  const [activeTab, setActiveTab] = useState<"tasks" | "notes">("tasks");

  // Effective date context
  const currentDate = selectedDate || getLocalDateString();

  // Tasks Backlog State
  const [tasks, setTasks] = useState<BacklogTask[]>([]);
  const [taskFilter, setTaskFilter] = useState<"all" | "active" | "completed">(
    "all",
  );
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskCat, setNewTaskCat] = useState("General");
  const [newTaskPriority, setNewTaskPriority] = useState<
    "High" | "Medium" | "Low"
  >("Medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [showAddTask, setShowAddTask] = useState(false);

  // Notes & Daily Notes State
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [noteScope, setNoteScope] = useState<"date" | "all">("date");
  const [noteSearch, setNoteSearch] = useState("");
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteTags, setNewNoteTags] = useState("");
  const [newNoteDate, setNewNoteDate] = useState(currentDate);
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

  // Note Inline Editing State
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editDate, setEditDate] = useState("");

  // Sync newNoteDate when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setNewNoteDate(selectedDate);
    }
  }, [selectedDate]);

  // Load from localStorage and listen for updates (e.g. Google Drive restore)
  useEffect(() => {
    const loadTasksAndNotes = () => {
      if (typeof window === "undefined") return;
      try {
        const savedTasks = getLocal<BacklogTask[]>(STORAGE_KEYS.TASKS, []);
        setTasks(Array.isArray(savedTasks) ? savedTasks : []);

        const savedNotes = getLocal<QuickNote[]>(STORAGE_KEYS.NOTES, []);
        setNotes(Array.isArray(savedNotes) ? savedNotes : []);
      } catch (err) {
        console.error("Failed to load tasks and notes from localStorage:", err);
      }
    };

    loadTasksAndNotes();

    const handleStorageUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ key?: string }>;
      const key = customEvent.detail?.key;
      if (
        !key ||
        key === "all" ||
        key === STORAGE_KEYS.TASKS ||
        key === STORAGE_KEYS.NOTES
      ) {
        loadTasksAndNotes();
      }
    };

    window.addEventListener("kanso-storage-updated", handleStorageUpdate);
    return () => {
      window.removeEventListener("kanso-storage-updated", handleStorageUpdate);
    };
  }, []);

  // Save tasks to localStorage
  const saveTasks = (updated: BacklogTask[]) => {
    setTasks(updated);
    setLocal(STORAGE_KEYS.TASKS, updated);
  };

  // Save notes to localStorage
  const saveNotes = (updated: QuickNote[]) => {
    setNotes(updated);
    setLocal(STORAGE_KEYS.NOTES, updated);
  };

  // Task Actions
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: BacklogTask = {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
      category: newTaskCat,
      priority: newTaskPriority,
      dueDate: newTaskDueDate || undefined,
      isCompleted: false,
      createdAt: new Date().toISOString(),
    };

    saveTasks([newTask, ...tasks]);
    setNewTaskTitle("");
    setNewTaskDueDate("");
    setShowAddTask(false);
  };

  const handleToggleTask = (id: string) => {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const next = !target.isCompleted;

    if (next) {
      confetti({ particleCount: 25, spread: 45, origin: { y: 0.7 } });
      recordUserActivity(15);
    } else {
      const stats = getUserStats();
      const newXP = Math.max(0, stats.xp - 15);
      setUserStats({
        ...stats,
        xp: newXP,
        level: Math.floor(newXP / 300) + 1,
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("streakflow-stats-updated"));
      }
    }

    const updated = tasks.map((t) =>
      t.id === id ? { ...t, isCompleted: next } : t,
    );
    saveTasks(updated);
  };

  const handleDeleteTask = (id: string) => {
    saveTasks(tasks.filter((t) => t.id !== id));
  };

  const handlePromoteToFocus = async (task: BacklogTask) => {
    if (onPromoteToFocus) {
      await onPromoteToFocus(task.title);
      confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
    }
  };

  // Note Actions
  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() && !newNoteContent.trim()) return;

    const tagsArr = newNoteTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const newNote: QuickNote = {
      id: Date.now().toString(),
      title: newNoteTitle.trim() || "Untitled Note",
      content: newNoteContent.trim(),
      tags: tagsArr,
      isPinned: false,
      date: newNoteDate || currentDate,
      updatedAt: new Date().toISOString(),
    };

    saveNotes([newNote, ...notes]);
    setNewNoteTitle("");
    setNewNoteContent("");
    setNewNoteTags("");
    setShowAddNote(false);
  };

  const handleStartEditNote = (note: QuickNote) => {
    setEditingNoteId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditTags(note.tags.join(", "));
    setEditDate(note.date || "");
  };

  const handleSaveEditNote = (id: string) => {
    const tagsArr = editTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const updated = notes.map((n) =>
      n.id === id
        ? {
            ...n,
            title: editTitle.trim() || "Untitled Note",
            content: editContent.trim(),
            tags: tagsArr,
            date: editDate || undefined,
            updatedAt: new Date().toISOString(),
          }
        : n,
    );

    saveNotes(updated);
    setEditingNoteId(null);
  };

  const handleToggleNoteCheckbox = (
    noteId: string,
    lineIndex: number,
    nextChecked: boolean,
  ) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    const lines = note.content.split("\n");
    if (lineIndex < 0 || lineIndex >= lines.length) return;

    const targetLine = lines[lineIndex];
    const taskMatch = targetLine.match(/^([-*]\s+\[)[ xX](\]\s+.*)$/);
    if (taskMatch) {
      lines[lineIndex] = `${taskMatch[1]}${nextChecked ? "x" : " "}${taskMatch[2]}`;
      const updatedContent = lines.join("\n");
      const updated = notes.map((n) =>
        n.id === noteId
          ? { ...n, content: updatedContent, updatedAt: new Date().toISOString() }
          : n,
      );
      saveNotes(updated);
    }
  };

  const handleTogglePinNote = (id: string) => {
    const updated = notes.map((n) =>
      n.id === id ? { ...n, isPinned: !n.isPinned } : n,
    );
    updated.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
    saveNotes(updated);
  };

  const handleDeleteNote = (id: string) => {
    saveNotes(notes.filter((n) => n.id !== id));
  };

  const handleCopyNoteContent = (note: QuickNote) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(note.content);
      setCopiedNoteId(note.id);
      setTimeout(() => setCopiedNoteId(null), 2000);
    }
  };

  // Filtered Task List
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (taskFilter === "active") return !t.isCompleted;
      if (taskFilter === "completed") return t.isCompleted;
      return true;
    });
  }, [tasks, taskFilter]);

  // Filtered Notes List
  const filteredNotes = useMemo(() => {
    let result = [...notes];

    // Filter by date scope if "date" scope is selected and no search query
    if (noteScope === "date" && !noteSearch.trim()) {
      result = result.filter((n) => {
        if (n.date) return n.date === currentDate;
        // Fallback: note created on this date if date property not set
        return n.updatedAt.startsWith(currentDate);
      });
    }

    // Filter by search query
    if (noteSearch.trim()) {
      const q = noteSearch.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q)) ||
          (n.date && n.date.includes(q)),
      );
    }

    // Pinned notes first, then latest updated
    return result.sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return b.isPinned ? 1 : -1;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [notes, noteScope, noteSearch, currentDate]);

  const dateNotesCount = useMemo(() => {
    return notes.filter((n) => {
      if (n.date) return n.date === currentDate;
      return n.updatedAt.startsWith(currentDate);
    }).length;
  }, [notes, currentDate]);

  const priorityColor = (p: "High" | "Medium" | "Low") => {
    switch (p) {
      case "High":
        return "text-rose-500 bg-rose-500/10 border-rose-500/30";
      case "Medium":
        return "text-amber-500 bg-amber-500/10 border-amber-500/30";
      case "Low":
        return "text-accent bg-accent-subtle border-accent/30";
    }
  };

  return (
    <div className="bg-surface-elevated border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 flex flex-col h-full space-y-4 font-mono">
      {/* Top Header & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-accent" />
          <h3 className="text-xs uppercase tracking-wider text-zinc-800 dark:text-zinc-200 font-bold">
            Plan & Daily Notes
          </h3>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("tasks")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition cursor-pointer text-xs ${
              activeTab === "tasks"
                ? "bg-surface-elevated text-accent font-bold border border-zinc-300 dark:border-zinc-700 shadow-xs"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Backlog ({tasks.filter((t) => !t.isCompleted).length})</span>
          </button>

          <button
            onClick={() => setActiveTab("notes")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition cursor-pointer text-xs ${
              activeTab === "notes"
                ? "bg-surface-elevated text-accent font-bold border border-zinc-300 dark:border-zinc-700 shadow-xs"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>
              Daily Notes (
              {noteScope === "date" ? dateNotesCount : notes.length})
            </span>
          </button>
        </div>
      </div>

      {/* VIEW 1: TASKS BACKLOG */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          {/* Action & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Filter Pill Tabs */}
            <div className="flex items-center gap-1 text-[11px] bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 self-start sm:self-auto">
              {(["all", "active", "completed"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTaskFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg capitalize transition cursor-pointer ${
                    taskFilter === filter
                      ? "bg-surface-elevated text-accent font-bold border border-zinc-300 dark:border-zinc-700"
                      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Add Task Button */}
            <button
              onClick={() => setShowAddTask(!showAddTask)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-accent hover:opacity-95 text-white text-xs font-bold transition cursor-pointer shadow-xs self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>{showAddTask ? "Cancel" : "Add Task"}</span>
            </button>
          </div>

          {/* Add Task Form Modal / Inline Card */}
          {showAddTask && (
            <form
              onSubmit={handleAddTask}
              className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-3 animate-in fade-in"
            >
              <h4 className="text-xs uppercase text-accent font-bold tracking-wider">
                Create Backlog Task
              </h4>
              <input
                type="text"
                placeholder="Task description (e.g., Solve 3 Graph Problems)"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                required
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:border-accent"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">
                    Category
                  </label>
                  <select
                    value={newTaskCat}
                    onChange={(e) => setNewTaskCat(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:border-accent cursor-pointer"
                  >
                    {[
                      "General",
                      "DSA",
                      "Project",
                      "College",
                      "Reading",
                      "Review",
                    ].map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">
                    Priority
                  </label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) =>
                      setNewTaskPriority(
                        e.target.value as "High" | "Medium" | "Low",
                      )
                    }
                    className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">
                    Due Date (Optional)
                  </label>
                  <CalendarPicker
                    value={newTaskDueDate}
                    onChange={setNewTaskDueDate}
                    placeholder="Pick due date"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTask(false)}
                  className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-accent hover:opacity-95 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
                >
                  Save Task
                </button>
              </div>
            </form>
          )}

          {/* Task Items List */}
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 bg-zinc-100/50 dark:bg-zinc-900/20 border border-zinc-200 dark:border-zinc-800/60 rounded-2xl text-zinc-500 text-xs">
              No tasks found in this view. Click &quot;Add Task&quot; to populate
              your backlog!
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800 pr-1">
              {filteredTasks.map((t) => (
                <div
                  key={t.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                    t.isCompleted
                      ? "bg-zinc-100/50 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800/40 opacity-70"
                      : "bg-surface-elevated border-zinc-200 dark:border-zinc-800 hover:border-accent/40"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                      onClick={() => handleToggleTask(t.id)}
                      className="cursor-pointer shrink-0 mt-0.5 text-zinc-400 hover:text-accent transition"
                    >
                      {t.isCompleted ? (
                        <CheckSquare className="w-4 h-4 text-accent" />
                      ) : (
                        <div className="w-4 h-4 rounded border border-zinc-400 dark:border-zinc-600 hover:border-accent" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <span
                        className={`text-xs block truncate ${
                          t.isCompleted
                            ? "line-through text-zinc-400 dark:text-zinc-500"
                            : "text-zinc-900 dark:text-zinc-100 font-semibold"
                        }`}
                      >
                        {t.title}
                      </span>
                      <div className="flex items-center gap-2 mt-1 text-[10px]">
                        <span className="text-zinc-500">{t.category}</span>
                        <span>•</span>
                        <span
                          className={`px-1.5 py-0.2 rounded border text-[9px] font-bold ${priorityColor(
                            t.priority,
                          )}`}
                        >
                          {t.priority}
                        </span>
                        {t.dueDate && (
                          <>
                            <span>•</span>
                            <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-accent" />
                              {t.dueDate}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!t.isCompleted && onPromoteToFocus && (
                      <button
                        onClick={() => handlePromoteToFocus(t)}
                        className="p-1.5 text-zinc-400 hover:text-accent hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition cursor-pointer"
                        title="Promote to Today's Rule-of-3 Focus"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteTask(t.id)}
                      className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition cursor-pointer"
                      title="Delete Task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: DAILY NOTES & MARKDOWN SCRATCHPAD */}
      {activeTab === "notes" && (
        <div className="space-y-4">
          {/* Notes Top Bar & Scope Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Scope Toggle: Date Notes vs All Notes */}
            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
              <button
                onClick={() => setNoteScope("date")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition cursor-pointer text-xs ${
                  noteScope === "date"
                    ? "bg-surface-elevated text-accent font-bold border border-zinc-300 dark:border-zinc-700 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>
                  Date Notes ({formatDisplayDate(currentDate)})
                </span>
              </button>

              <button
                onClick={() => setNoteScope("all")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition cursor-pointer text-xs ${
                  noteScope === "all"
                    ? "bg-surface-elevated text-accent font-bold border border-zinc-300 dark:border-zinc-700 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>All Notes ({notes.length})</span>
              </button>
            </div>

            {/* Search Input & New Note Button */}
            <div className="flex items-center gap-2 flex-1 sm:justify-end">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search notes or tags..."
                  value={noteSearch}
                  onChange={(e) => setNoteSearch(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:border-accent"
                />
              </div>

              <button
                onClick={() => setShowAddNote(!showAddNote)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-accent hover:opacity-95 text-white text-xs font-bold transition cursor-pointer shadow-xs shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>{showAddNote ? "Cancel" : "New Note"}</span>
              </button>
            </div>
          </div>

          {/* Add Note Form */}
          {showAddNote && (
            <form
              onSubmit={handleAddNote}
              className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-3 animate-in fade-in"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs uppercase text-accent font-bold tracking-wider">
                  Create Daily Note / Markdown
                </h4>
                <div className="w-44">
                  <CalendarPicker
                    value={newNoteDate}
                    onChange={setNewNoteDate}
                    placeholder="Linked Date"
                  />
                </div>
              </div>

              <input
                type="text"
                placeholder="Note Title (e.g., Daily Reflection, Bitmask DP Pattern)"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:border-accent"
              />

              <textarea
                rows={6}
                placeholder="Write Markdown, code blocks (```python), or checklist items (- [ ] Task)..."
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                required
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-100 outline-none focus:border-accent resize-y"
              />

              <input
                type="text"
                placeholder="Comma separated tags (e.g. daily, dsa, contest, idea)"
                value={newNoteTags}
                onChange={(e) => setNewNoteTags(e.target.value)}
                className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:border-accent"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddNote(false)}
                  className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-accent hover:opacity-95 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
                >
                  Save Note
                </button>
              </div>
            </form>
          )}

          {/* Notes Grid */}
          {filteredNotes.length === 0 ? (
            <div className="text-center py-12 bg-zinc-100/50 dark:bg-zinc-900/20 border border-zinc-200 dark:border-zinc-800/60 rounded-2xl text-zinc-500 text-xs space-y-1">
              <p>
                {noteScope === "date"
                  ? `No notes for ${formatDisplayDate(currentDate)}.`
                  : "No notes found matching your search."}
              </p>
              <p className="text-[11px] text-zinc-400">
                Click &quot;New Note&quot; to jot down daily thoughts, Markdown,
                or code snippets!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[560px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800 pr-1">
              {filteredNotes.map((n) => {
                const isEditing = editingNoteId === n.id;

                if (isEditing) {
                  return (
                    <div
                      key={n.id}
                      className="p-4 rounded-2xl border border-accent bg-surface-elevated space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-accent">
                          Edit Note
                        </span>
                        <button
                          onClick={() => setEditingNoteId(null)}
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Title"
                        className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                      />

                      <textarea
                        rows={6}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-100 outline-none resize-y"
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <CalendarPicker
                          value={editDate}
                          onChange={setEditDate}
                          placeholder="Linked Date"
                        />
                        <input
                          type="text"
                          value={editTags}
                          onChange={(e) => setEditTags(e.target.value)}
                          placeholder="Tags"
                          className="bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingNoteId(null)}
                          className="px-3 py-1 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEditNote(n.id)}
                          className="px-3.5 py-1 bg-accent text-white font-bold rounded-lg text-xs shadow-xs"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={n.id}
                    className={`p-4 rounded-2xl border flex flex-col justify-between transition-all ${
                      n.isPinned
                        ? "bg-surface-elevated border-accent shadow-xs"
                        : "bg-surface-elevated border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-zinc-200 dark:border-zinc-800/80 gap-2">
                        <div className="min-w-0 flex-1 flex items-center gap-1.5">
                          {n.isPinned && (
                            <Pin className="w-3 h-3 text-accent shrink-0 fill-accent" />
                          )}
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                            {n.title}
                          </span>
                        </div>

                        {/* Note Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleTogglePinNote(n.id)}
                            className={`p-1 rounded-lg transition cursor-pointer ${
                              n.isPinned
                                ? "text-accent bg-accent-subtle"
                                : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            }`}
                            title={n.isPinned ? "Unpin Note" : "Pin Note to Top"}
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleStartEditNote(n)}
                            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                            title="Edit Note"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleCopyNoteContent(n)}
                            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                            title="Copy Content"
                          >
                            {copiedNoteId === n.id ? (
                              <Check className="w-3.5 h-3.5 text-accent" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteNote(n.id)}
                            className="p-1 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                            title="Delete Note"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Markdown Rendered Content */}
                      <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800 pr-1">
                        <MarkdownViewer
                          content={n.content}
                          onToggleCheckbox={(lineIdx, nextChecked) =>
                            handleToggleNoteCheckbox(n.id, lineIdx, nextChecked)
                          }
                        />
                      </div>
                    </div>

                    {/* Card Footer: Date & Tags */}
                    <div className="flex items-center justify-between gap-2 flex-wrap pt-3 mt-2.5 border-t border-zinc-200 dark:border-zinc-800/60 text-[10px]">
                      {n.date ? (
                        <button
                          type="button"
                          onClick={() => onSelectDate?.(n.date!)}
                          className="text-zinc-500 hover:text-accent flex items-center gap-1 transition cursor-pointer font-mono"
                          title="Filter to this date"
                        >
                          <Calendar className="w-3 h-3 text-accent" />
                          <span>{formatDisplayDate(n.date)}</span>
                        </button>
                      ) : (
                        <span className="text-zinc-400 font-mono text-[9px]">
                          Undated
                        </span>
                      )}

                      {n.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {n.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-[9px] flex items-center gap-1"
                            >
                              <Tag className="w-2.5 h-2.5 text-zinc-400" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
