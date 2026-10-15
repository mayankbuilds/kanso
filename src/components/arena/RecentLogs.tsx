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
        <span className="text-xs font-mono text-zinc-500 uppercase flex items-center gap-1.5">
          <Code2 className="w-3.5 h-3.5 text-emerald-400" /> Recent Submissions
        </span>
        <button
          onClick={openAllSubmissions}
          className="text-xs font-mono text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1 cursor-pointer bg-zinc-900/80 hover:bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-800"
        >
          <List className="w-3.5 h-3.5" />
          <span>View All</span>
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="text-xs font-mono text-zinc-600 p-6 border border-dashed border-zinc-800 rounded-xl text-center">
          No problems logged yet. Complete a problem in the arena to start your
          record!
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="group flex items-center justify-between p-3 bg-zinc-900/30 hover:bg-zinc-900/70 border border-zinc-800/60 rounded-xl transition"
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded shrink-0 ${
                    log.difficulty === "Easy"
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                      : log.difficulty === "Hard"
                        ? "bg-rose-950 text-rose-400 border border-rose-800/60"
                        : "bg-amber-950 text-amber-400 border border-amber-800/60"
                  }`}
                >
                  {log.difficulty}
                </span>
                <span className="text-xs font-mono text-zinc-200 truncate">
                  {log.problem_title}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0 text-xs font-mono text-zinc-500">
                <span className="hidden sm:inline bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-[11px]">
                  {log.platform}
                </span>
                <span className="text-[11px]">{log.solved_at}</span>

                {/* Edit & Delete Actions */}
                <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(log)}
                    className="p-1 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                    title="Edit Submission"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(log.id)}
                    className="p-1 rounded bg-zinc-800/80 hover:bg-rose-950 text-zinc-400 hover:text-rose-400 transition cursor-pointer"
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
              className="w-full text-center py-2.5 rounded-xl border border-zinc-800/80 bg-zinc-950/60 hover:bg-zinc-900 text-xs font-mono text-zinc-400 hover:text-emerald-400 transition flex items-center justify-center gap-1.5 cursor-pointer mt-2"
            >
              <List className="w-3.5 h-3.5" />
              View all previous submissions in ledger
            </button>
          )}
        </div>
      )}

      {/* EDIT MODAL */}
      {editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-md rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-400" /> Edit Submission
                Log
              </span>
              <button
                onClick={closeEdit}
                className="text-zinc-500 hover:text-zinc-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">
                  Problem Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Platform</label>
                  <select
                    value={editPlatform}
                    onChange={(e) => setEditPlatform(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Difficulty</label>
                  <select
                    value={editDifficulty}
                    onChange={(e) => setEditDifficulty(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-zinc-100 focus:outline-none focus:border-emerald-500"
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
                <label className="block text-zinc-400 mb-1">Topic Tag</label>
                <input
                  type="text"
                  value={editTag}
                  onChange={(e) => setEditTag(e.target.value)}
                  placeholder="e.g. Dynamic Programming, Trees"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => handleDelete(editingLog.id)}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 transition"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Log
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !editTitle.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition flex items-center gap-1.5 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-3xl max-h-[90vh] rounded-2xl flex flex-col shadow-2xl font-mono overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <List className="w-4 h-4 text-emerald-400" /> Complete
                  Submissions Ledger
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  All solved coding problems tracked in Kanso (
                  {filteredAllLogs.length} shown)
                </p>
              </div>
              <button
                onClick={() => setShowAllModal(false)}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Bar */}
            <div className="p-3 sm:p-4 bg-zinc-900/40 border-b border-zinc-800/80 space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search problem title or topic tag..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500 text-[10px] uppercase">
                    Platform:
                  </span>
                  {["All", ...PLATFORMS].map((p) => (
                    <button
                      key={p}
                      onClick={() => setFilterPlatform(p)}
                      className={`px-2 py-0.5 rounded-md border text-[10px] transition ${
                        filterPlatform === p
                          ? "bg-emerald-950 text-emerald-400 border-emerald-800 font-bold"
                          : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-zinc-500 text-[10px] uppercase">
                    Diff:
                  </span>
                  {["All", ...DIFFICULTIES].map((d) => (
                    <button
                      key={d}
                      onClick={() => setFilterDifficulty(d)}
                      className={`px-2 py-0.5 rounded-md border text-[10px] transition ${
                        filterDifficulty === d
                          ? "bg-zinc-800 text-zinc-100 border-zinc-600 font-bold"
                          : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200"
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
                <div className="py-12 text-center text-xs text-zinc-500">
                  Loading problem history...
                </div>
              ) : filteredAllLogs.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-500">
                  No submissions matched your search criteria.
                </div>
              ) : (
                filteredAllLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 bg-zinc-900/30 hover:bg-zinc-900/70 border border-zinc-800/60 rounded-xl transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded shrink-0 ${
                          log.difficulty === "Easy"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                            : log.difficulty === "Hard"
                              ? "bg-rose-950 text-rose-400 border border-rose-800/60"
                              : "bg-amber-950 text-amber-400 border border-amber-800/60"
                        }`}
                      >
                        {log.difficulty}
                      </span>
                      <div className="truncate">
                        <span className="text-xs text-zinc-200 block truncate">
                          {log.problem_title}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {log.topic_tag} • {log.platform}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-xs">
                      <span className="text-[11px] text-zinc-500">
                        {log.solved_at}
                      </span>
                      <button
                        onClick={() => openEdit(log)}
                        className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                        title="Edit Submission"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(log.id)}
                        className="p-1.5 rounded bg-zinc-800 hover:bg-rose-950 text-zinc-300 hover:text-rose-400 transition"
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
            <div className="p-3 sm:p-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between text-xs text-zinc-500">
              <span>Showing {filteredAllLogs.length} total entries</span>
              <button
                onClick={() => setShowAllModal(false)}
                className="px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs transition"
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
