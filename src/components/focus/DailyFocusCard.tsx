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
          ? "bg-surface-muted border-border-subtle text-muted-foreground"
          : item
            ? "bg-surface border-border-subtle text-foreground shadow-xs"
            : "bg-surface-muted/50 border-dashed border-border-subtle text-muted-foreground hover:border-border-strong"
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
                  ? "line-through text-muted-foreground"
                  : "text-foreground"
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
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-surface-hover transition cursor-pointer"
                title="Edit task"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="p-1.5 text-muted-foreground hover:text-rose-500 rounded-lg hover:bg-surface-hover transition cursor-pointer"
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
                    : "bg-surface-muted border-border-subtle text-muted-foreground hover:bg-surface-hover hover:text-foreground"
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
              className="flex-1 bg-transparent text-xs text-foreground placeholder-subtle-foreground focus:outline-hidden font-mono"
              autoFocus={isEditing}
            />
            <button
              type="submit"
              disabled={loading || !inputValue.trim()}
              className="bg-accent hover:bg-accent-hover disabled:opacity-40 text-accent-foreground px-2.5 py-1 text-xs rounded-lg font-mono transition flex items-center gap-1 cursor-pointer"
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
                className="text-xs text-muted-foreground hover:text-foreground px-1 cursor-pointer"
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
