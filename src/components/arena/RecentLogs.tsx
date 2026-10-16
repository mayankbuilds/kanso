"use client";

import { useState } from "react";
import { Edit3, Trash2, List, Search, X, Check, Code2 } from "lucide-react";
import { CodingLog } from "@/types";
import { api } from "@/lib/api";

interface RecentLogsProps {
  logs: CodingLog[];
  onUpdateLog?: (
    id: number,
    data: {
      problem_title?: string;
      platform?: string;
      difficulty?: string;
      topic_tag?: string;
    },
  ) => Promise<void>;
  onDeleteLog?: (id: number) => Promise<void>;
  onRefresh?: () => Promise<void>;
}

const PLATFORMS = [
  "LeetCode",
  "Codeforces",
  "CodeChef",
  "HackerRank",
  "AtCoder",
  "Other",
];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];

export default function RecentLogs({
  logs,
  onUpdateLog,
  onDeleteLog,
  onRefresh,
}: RecentLogsProps) {
  // Edit Dialog State
  const [editingLog, setEditingLog] = useState<CodingLog | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPlatform, setEditPlatform] = useState("LeetCode");
  const [editDifficulty, setEditDifficulty] = useState("Medium");
  const [editTag, setEditTag] = useState("DSA");
  const [savingEdit, setSavingEdit] = useState(false);

  // All Submissions Modal State
  const [showAllModal, setShowAllModal] = useState(false);
  const [allLogs, setAllLogs] = useState<CodingLog[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("All");
  const [filterDifficulty, setFilterDifficulty] = useState("All");

  const openEdit = (log: CodingLog) => {
    setEditingLog(log);
    setEditTitle(log.problem_title);
    setEditPlatform(log.platform);
    setEditDifficulty(log.difficulty);
    setEditTag(log.topic_tag || "DSA");
  };

  const closeEdit = () => {
    setEditingLog(null);
  };

  const handleSaveEdit = async () => {
    if (!editingLog || !editTitle.trim()) return;
    setSavingEdit(true);
    try {
      if (onUpdateLog) {
        await onUpdateLog(editingLog.id, {
          problem_title: editTitle.trim(),
          platform: editPlatform,
          difficulty: editDifficulty,
          topic_tag: editTag.trim() || "DSA",
        });
      } else {
        await api.updateCodingLog(editingLog.id, {
          problem_title: editTitle.trim(),
          platform: editPlatform,
          difficulty: editDifficulty,
          topic_tag: editTag.trim() || "DSA",
        });
        if (onRefresh) await onRefresh();
      }

      // Update local allLogs if open
      setAllLogs((prev) =>
        prev.map((l) =>
          l.id === editingLog.id
            ? {
                ...l,
                problem_title: editTitle.trim(),
                platform: editPlatform,
                difficulty: editDifficulty,
                topic_tag: editTag.trim() || "DSA",
              }
            : l,
        ),
      );

      closeEdit();
    } catch (err) {
      console.error("Failed to update log:", err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      if (onDeleteLog) {
        await onDeleteLog(id);
      } else {
        await api.deleteCodingLog(id);
        if (onRefresh) await onRefresh();
      }
      setAllLogs((prev) => prev.filter((l) => l.id !== id));
      if (editingLog?.id === id) closeEdit();
    } catch (err) {
      console.error("Failed to delete log:", err);
    }
  };

  const openAllSubmissions = async () => {
    setShowAllModal(true);
    setLoadingAll(true);
    try {
      const data = await api.getRecentLogs(500, 0);
      setAllLogs(data);
    } catch (err) {
      console.error("Failed to fetch all logs:", err);
    } finally {
      setLoadingAll(false);
    }
  };

  // Filtered list for "All Submissions" modal
  const filteredAllLogs = allLogs.filter((log) => {
    const matchesSearch =
      log.problem_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.topic_tag.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlatform =
      filterPlatform === "All" || log.platform === filterPlatform;
    const matchesDiff =
      filterDifficulty === "All" || log.difficulty === filterDifficulty;
    return matchesSearch && matchesPlatform && matchesDiff;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground uppercase flex items-center gap-1.5 font-medium">
          <Code2 className="w-3.5 h-3.5 text-accent" /> Recent Submissions
        </span>
        <button
          onClick={openAllSubmissions}
          className="text-xs font-mono text-accent hover:opacity-80 transition flex items-center gap-1 cursor-pointer bg-surface-muted hover:bg-surface-elevated px-2.5 py-1 rounded-lg border border-border-subtle"
        >
          <List className="w-3.5 h-3.5" />
          <span>View All</span>
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="text-xs font-mono text-muted-foreground p-6 border border-dashed border-border-subtle rounded-xl text-center bg-surface-muted/30">
          No problems logged yet. Complete a problem in the arena to start your
          record!
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="group flex items-center justify-between p-3 bg-surface hover:bg-surface-elevated border border-border-subtle rounded-xl transition"
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <span
                  className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border shrink-0 ${
                    log.difficulty === "Easy"
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                      : log.difficulty === "Hard"
                        ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                        : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                  }`}
                >
                  {log.difficulty}
                </span>
                <span className="text-xs font-mono text-foreground truncate">
                  {log.problem_title}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0 text-xs font-mono text-muted-foreground">
                <span className="hidden sm:inline bg-surface-muted px-2 py-0.5 rounded border border-border-subtle text-[11px]">
                  {log.platform}
                </span>
                <span className="text-[11px]">{log.solved_at}</span>

                {/* Edit & Delete Actions */}
                <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(log)}
                    className="p-1 rounded bg-surface-muted hover:bg-surface-elevated text-muted-foreground hover:text-foreground border border-border-subtle transition cursor-pointer"
                    title="Edit Submission"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(log.id)}
                    className="p-1 rounded bg-surface-muted hover:bg-surface-elevated text-muted-foreground hover:text-rose-500 border border-border-subtle transition cursor-pointer"
                    title="Delete Submission"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {logs.length >= 10 && (
            <button
              onClick={openAllSubmissions}
              className="w-full text-center py-2.5 rounded-xl border border-border-subtle bg-surface hover:bg-surface-elevated text-xs font-mono text-muted-foreground hover:text-accent transition flex items-center justify-center gap-1.5 cursor-pointer mt-2"
            >
              <List className="w-3.5 h-3.5" />
              View all previous submissions in ledger
            </button>
          )}
        </div>
      )}

      {/* EDIT MODAL */}
      {editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface border border-border-subtle w-full max-w-md rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-accent" /> Edit Submission
                Log
              </span>
              <button
                onClick={closeEdit}
                className="text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1">
                  Problem Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-surface-muted border border-border-subtle rounded-xl p-2.5 text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1">Platform</label>
                  <select
                    value={editPlatform}
                    onChange={(e) => setEditPlatform(e.target.value)}
                    className="w-full bg-surface-muted border border-border-subtle rounded-xl p-2.5 text-foreground focus:outline-none focus:border-accent cursor-pointer"
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-muted-foreground mb-1">Difficulty</label>
                  <select
                    value={editDifficulty}
                    onChange={(e) => setEditDifficulty(e.target.value)}
                    className="w-full bg-surface-muted border border-border-subtle rounded-xl p-2.5 text-foreground focus:outline-none focus:border-accent cursor-pointer"
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Topic Tag</label>
                <input
                  type="text"
                  value={editTag}
                  onChange={(e) => setEditTag(e.target.value)}
                  placeholder="e.g. Dynamic Programming, Trees"
                  className="w-full bg-surface-muted border border-border-subtle rounded-xl p-2.5 text-foreground focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => handleDelete(editingLog.id)}
                className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Log
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="px-4 py-2 rounded-xl bg-surface-muted hover:bg-surface-elevated text-muted-foreground hover:text-foreground border border-border-subtle text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !editTitle.trim()}
                  className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-accent-foreground font-medium text-xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  <Check className="w-4 h-4" /> Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW ALL SUBMISSIONS POPUP MODAL */}
      {showAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6">
          <div className="bg-surface border border-border-subtle w-full max-w-3xl max-h-[90vh] rounded-2xl flex flex-col shadow-xl font-mono overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-border-subtle flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                  <List className="w-4 h-4 text-accent" /> Complete
                  Submissions Ledger
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  All solved coding problems tracked in Kanso (
                  {filteredAllLogs.length} shown)
                </p>
              </div>
              <button
                onClick={() => setShowAllModal(false)}
                className="p-1.5 rounded-lg bg-surface-muted hover:bg-surface-elevated text-muted-foreground hover:text-foreground border border-border-subtle transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Bar */}
            <div className="p-3 sm:p-4 bg-surface-muted/60 border-b border-border-subtle space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search problem title or topic tag..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface border border-border-subtle rounded-xl pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground text-[10px] uppercase">
                    Platform:
                  </span>
                  {["All", ...PLATFORMS].map((p) => (
                    <button
                      key={p}
                      onClick={() => setFilterPlatform(p)}
                      className={`px-2 py-0.5 rounded-md border text-[10px] transition cursor-pointer ${
                        filterPlatform === p
                          ? "bg-accent-subtle text-accent border-accent/40 font-medium"
                          : "bg-surface text-muted-foreground border-border-subtle hover:text-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-muted-foreground text-[10px] uppercase">
                    Diff:
                  </span>
                  {["All", ...DIFFICULTIES].map((d) => (
                    <button
                      key={d}
                      onClick={() => setFilterDifficulty(d)}
                      className={`px-2 py-0.5 rounded-md border text-[10px] transition cursor-pointer ${
                        filterDifficulty === d
                          ? "bg-surface-elevated text-foreground border-border-strong font-medium"
                          : "bg-surface text-muted-foreground border-border-subtle hover:text-foreground"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2">
              {loadingAll ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  Loading problem history...
                </div>
              ) : filteredAllLogs.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No submissions matched your search criteria.
                </div>
              ) : (
                filteredAllLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 bg-surface hover:bg-surface-elevated border border-border-subtle rounded-xl transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span
                        className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border shrink-0 ${
                          log.difficulty === "Easy"
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                            : log.difficulty === "Hard"
                              ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                              : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                        }`}
                      >
                        {log.difficulty}
                      </span>
                      <div className="truncate">
                        <span className="text-xs text-foreground block truncate">
                          {log.problem_title}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {log.topic_tag} • {log.platform}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-xs">
                      <span className="text-[11px] text-muted-foreground">
                        {log.solved_at}
                      </span>
                      <button
                        onClick={() => openEdit(log)}
                        className="p-1.5 rounded bg-surface-muted hover:bg-surface-elevated text-muted-foreground hover:text-foreground border border-border-subtle transition cursor-pointer"
                        title="Edit Submission"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(log.id)}
                        className="p-1.5 rounded bg-surface-muted hover:bg-surface-elevated text-muted-foreground hover:text-rose-500 border border-border-subtle transition cursor-pointer"
                        title="Delete Submission"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-border-subtle bg-surface flex items-center justify-between text-xs text-muted-foreground">
              <span>Showing {filteredAllLogs.length} total entries</span>
              <button
                onClick={() => setShowAllModal(false)}
                className="px-4 py-1.5 rounded-xl bg-surface-muted hover:bg-surface-elevated text-foreground border border-border-subtle text-xs transition cursor-pointer"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
