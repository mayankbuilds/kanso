"use client";

import { useState } from "react";
import { Check, Edit2, Loader2, Plus, Trash2 } from "lucide-react";
import { DailyFocus } from "@/types";

interface DailyFocusCardProps {
  slotNumber: number;
  item?: DailyFocus;
  onSave: (priority: number, title: string) => Promise<void>;
  onToggle: (item: DailyFocus) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export default function DailyFocusCard({
  slotNumber,
  item,
  onSave,
  onToggle,
  onDelete,
}: DailyFocusCardProps) {
  const [inputValue, setInputValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await onSave(slotNumber, inputValue);
      setInputValue("");
      setIsEditing(false);
    } catch (err) {
      console.error("Save failed:", err);
      setError("Failed to save task.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!item) return;
    setLoading(true);
    try {
      await onToggle(item);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    setLoading(true);
    try {
      await onDelete(item.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`p-3.5 rounded-xl border transition-all ${
        item?.is_completed
          ? "bg-zinc-50 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800 text-zinc-400"
          : item
            ? "bg-white dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-700/80 text-zinc-900 dark:text-zinc-100 shadow-xs"
            : "bg-zinc-50/50 dark:bg-zinc-950/30 border-dashed border-zinc-300 dark:border-zinc-800 text-zinc-500 hover:border-zinc-400 dark:hover:border-zinc-700"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Priority Badge */}
        <span className="font-mono text-xs font-bold text-accent bg-accent-subtle px-2 py-0.5 rounded border border-accent">
          #{slotNumber}
        </span>

        {/* Existing Item View */}
        {item && !isEditing ? (
          <div className="flex-1 flex items-center justify-between min-w-0 gap-2">
            <span
              className={`text-xs font-mono font-medium truncate ${
                item.is_completed
                  ? "line-through text-zinc-400 dark:text-zinc-500"
                  : "text-zinc-800 dark:text-zinc-200"
              }`}
            >
              {item.title}
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setInputValue(item.title);
                  setIsEditing(true);
                }}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                title="Edit task"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="p-1.5 text-zinc-400 hover:text-rose-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                title="Clear slot"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleToggle}
                disabled={loading}
                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                  item.is_completed
                    ? "bg-accent-subtle border-accent text-accent"
                    : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white"
                }`}
                title={item.is_completed ? "Mark incomplete" : "Mark completed"}
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Empty Slot Input Form */
          <form
            onSubmit={handleSubmit}
            className="flex-1 flex items-center gap-2"
          >
            <input
              type="text"
              placeholder={`Priority #${slotNumber}...`}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={loading}
              className="flex-1 bg-transparent text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-hidden font-mono"
              autoFocus={isEditing}
            />
            <button
              type="submit"
              disabled={loading || !inputValue.trim()}
              className="bg-accent hover:opacity-95 disabled:opacity-40 text-white px-2.5 py-1 text-xs rounded-lg font-mono transition flex items-center gap-1 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : isEditing ? (
                "Save"
              ) : (
                <>
                  <Plus className="w-3 h-3" /> Set
                </>
              )}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 px-1 cursor-pointer"
              >
                Cancel
              </button>
            )}
          </form>
        )}
      </div>
      {error && (
        <p className="text-[10px] text-rose-500 mt-1.5 pl-8 font-mono">
          {error}
        </p>
      )}
    </div>
  );
}
