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
} from "lucide-react";
import confetti from "canvas-confetti";
import CalendarPicker from "@/components/ui/CalendarPicker";
import {
  STORAGE_KEYS,
  getLocal,
  setLocal,
  recordUserActivity,
  getUserStats,
  setUserStats,
} from "@/lib/storage";

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
  updatedAt: string;
}

interface TasksAndNotesProps {
  onPromoteToFocus?: (title: string) => Promise<void>;
}

export default function TasksAndNotes({
  onPromoteToFocus,
}: TasksAndNotesProps) {
  const [activeTab, setActiveTab] = useState<"tasks" | "notes">("tasks");

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

  // Notes & Scratchpad State
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [noteSearch, setNoteSearch] = useState("");
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteTags, setNewNoteTags] = useState("");
  const [showAddNote, setShowAddNote] = useState(false);
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

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
      if (!key || key === "all" || key === STORAGE_KEYS.TASKS || key === STORAGE_KEYS.NOTES) {
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
      confetti({ particleCount: 30, spread: 45, origin: { y: 0.7 } });
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
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
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
      updatedAt: new Date().toISOString(),
    };

    saveNotes([newNote, ...notes]);
    setNewNoteTitle("");
    setNewNoteContent("");
    setNewNoteTags("");
    setShowAddNote(false);
  };

  const handleTogglePinNote = (id: string) => {
    const updated = notes.map((n) =>
      n.id === id ? { ...n, isPinned: !n.isPinned } : n,
    );
    // Sort pinned to top
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
    if (!noteSearch.trim()) {
      return [...notes].sort(
        (a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0),
      );
    }
    const q = noteSearch.toLowerCase();
    return notes
      .filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q)),
      )
      .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
  }, [notes, noteSearch]);

  const priorityColor = (p: "High" | "Medium" | "Low") => {
    switch (p) {
      case "High":
        return "text-rose-400 bg-rose-950/60 border-rose-800";
      case "Medium":
        return "text-amber-400 bg-amber-950/60 border-amber-800";
      case "Low":
        return "text-cyan-400 bg-cyan-950/60 border-cyan-800";
    }
  };

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 flex flex-col h-full space-y-4 font-mono">
      {/* Top Header & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs uppercase tracking-wider text-zinc-300 font-bold">
            Tasks & Notes
          </h3>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("tasks")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition cursor-pointer text-xs ${
              activeTab === "tasks"
                ? "bg-zinc-800 text-emerald-400 font-bold border border-zinc-700 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Backlog ({tasks.filter((t) => !t.isCompleted).length})</span>
          </button>

          <button
            onClick={() => setActiveTab("notes")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition cursor-pointer text-xs ${
              activeTab === "notes"
                ? "bg-zinc-800 text-cyan-400 font-bold border border-zinc-700 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Scratchpad ({notes.length})</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: TASKS BACKLOG */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 text-xs">
              {(["all", "active", "completed"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTaskFilter(filter)}
                  className={`px-3 py-1 rounded-lg capitalize transition cursor-pointer ${
                    taskFilter === filter
                      ? "bg-zinc-800 text-emerald-400 font-bold"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowAddTask(!showAddTask)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition cursor-pointer shadow-sm self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>{showAddTask ? "Cancel" : "Add Task"}</span>
            </button>
          </div>

          {/* Add Task Form */}
          {showAddTask && (
            <form
              onSubmit={handleAddTask}
              className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-3 animate-in fade-in"
            >
              <h4 className="text-xs uppercase text-zinc-300 font-bold tracking-wider">
                Create Backlog Task
              </h4>
              <input
                type="text"
                placeholder="What needs to be done? (e.g., Read DP optimization article)"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">
                    Category
                  </label>
                  <select
                    value={newTaskCat}
                    onChange={(e) => setNewTaskCat(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                  >
                    <option value="General">General</option>
                    <option value="Coding">Coding</option>
                    <option value="College">College</option>
                    <option value="Project">Project</option>
                    <option value="Revision">Revision</option>
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
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                  >
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">
                    Due Date (Calendar)
                  </label>
                  <CalendarPicker
                    value={newTaskDueDate}
                    onChange={setNewTaskDueDate}
                    placeholder="Pick due date..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTask(false)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Save Task
                </button>
              </div>
            </form>
          )}

          {/* Task List Items */}
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 bg-zinc-900/20 border border-zinc-800/60 rounded-2xl text-zinc-500 text-xs">
              No tasks found in this view. Click &quot;Add Task&quot; to create
              one!
            </div>
          ) : (
            <div className="space-y-2 max-h-[540px] overflow-y-auto scrollbar-none pr-1">
              {filteredTasks.map((t) => (
                <div
                  key={t.id}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                    t.isCompleted
                      ? "bg-zinc-950/40 border-zinc-900 opacity-60"
                      : "bg-zinc-900/40 hover:bg-zinc-900/70 border-zinc-800/80 shadow-sm"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => handleToggleTask(t.id)}
                      className={`w-5 h-5 rounded-lg border flex items-center justify-center transition cursor-pointer shrink-0 ${
                        t.isCompleted
                          ? "bg-emerald-500 border-emerald-400 text-black"
                          : "border-zinc-700 hover:border-emerald-400 bg-zinc-950"
                      }`}
                    >
                      {t.isCompleted && (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <span
                        className={`text-xs block truncate ${
                          t.isCompleted
                            ? "line-through text-zinc-500"
                            : "text-zinc-200 font-bold"
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
                            <span className="text-zinc-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-zinc-500" />
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
                        className="p-1.5 text-zinc-400 hover:text-orange-400 hover:bg-zinc-800 rounded-lg transition cursor-pointer"
                        title="Promote to Today's Rule-of-3 Focus"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteTask(t.id)}
                      className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 rounded-lg transition cursor-pointer"
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

      {/* VIEW 2: CODE SCRATCHPAD & QUICK NOTES */}
      {activeTab === "notes" && (
        <div className="space-y-4">
          {/* Notes Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search notes by keyword or tag..."
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-500"
              />
            </div>

            <button
              onClick={() => setShowAddNote(!showAddNote)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition cursor-pointer shadow-sm self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>{showAddNote ? "Cancel" : "New Note"}</span>
            </button>
          </div>

          {/* Add Note Card */}
          {showAddNote && (
            <form
              onSubmit={handleAddNote}
              className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-3 animate-in fade-in"
            >
              <h4 className="text-xs uppercase text-cyan-300 font-bold tracking-wider">
                Create Code or Markdown Note
              </h4>
              <input
                type="text"
                placeholder="Note Title (e.g., Fenwick Tree Bitmask Tricks)"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none focus:border-cyan-500"
              />
              <textarea
                rows={5}
                placeholder="Write code snippets, algorithmic patterns, or quick thoughts here..."
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 outline-none focus:border-cyan-500 resize-y"
              />
              <input
                type="text"
                placeholder="Comma separated tags (e.g. dsa, graph, tips)"
                value={newNoteTags}
                onChange={(e) => setNewNoteTags(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none focus:border-cyan-500"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddNote(false)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Save Note
                </button>
              </div>
            </form>
          )}

          {/* Notes Grid */}
          {filteredNotes.length === 0 ? (
            <div className="text-center py-12 bg-zinc-900/20 border border-zinc-800/60 rounded-2xl text-zinc-500 text-xs">
              No notes found. Click &quot;New Note&quot; to jot down code,
              ideas, or study links!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[540px] overflow-y-auto scrollbar-none pr-1">
              {filteredNotes.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 rounded-2xl border flex flex-col justify-between transition-all ${
                    n.isPinned
                      ? "bg-zinc-900/80 border-cyan-800/70 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                      : "bg-zinc-900/40 hover:bg-zinc-900/60 border-zinc-800/80"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/80">
                      <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 truncate">
                        {n.isPinned && (
                          <Pin className="w-3 h-3 text-cyan-400 fill-cyan-400" />
                        )}
                        {n.title}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleTogglePinNote(n.id)}
                          className={`p-1 rounded-lg transition cursor-pointer ${
                            n.isPinned
                              ? "text-cyan-400 bg-cyan-950/60"
                              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                          }`}
                          title={n.isPinned ? "Unpin Note" : "Pin Note to Top"}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCopyNoteContent(n)}
                          className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition cursor-pointer"
                          title="Copy Content"
                        >
                          {copiedNoteId === n.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteNote(n.id)}
                          className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition cursor-pointer"
                          title="Delete Note"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed bg-zinc-950/70 p-3 rounded-xl border border-zinc-900 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
                      {n.content}
                    </pre>
                  </div>

                  {n.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-3 mt-2 border-t border-zinc-800/60">
                      {n.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[9px] px-2 py-0.5 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-400 flex items-center gap-1"
                        >
                          <Tag className="w-2.5 h-2.5 text-zinc-500" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
