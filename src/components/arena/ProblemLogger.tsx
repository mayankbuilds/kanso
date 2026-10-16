"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

interface ProblemLoggerProps {
  onLog: (data: {
    problem_title: string;
    platform: string;
    difficulty: string;
    topic_tag: string;
  }) => Promise<void>;
}

export default function ProblemLogger({ onLog }: ProblemLoggerProps) {
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("LeetCode");
  const [difficulty, setDifficulty] = useState("Medium");
  const topicTag = "DSA";
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;

    setSubmitting(true);
    try {
      await onLog({
        problem_title: title.trim(),
        platform,
        difficulty,
        topic_tag: topicTag,
      });
      setTitle("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface border border-border-subtle rounded-2xl p-4 transition-all focus-within:border-border-strong"
    >
      <span className="text-xs font-mono text-muted-foreground block mb-2 font-medium">
        Log Solved Problem (+30 XP):
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
        <input
          type="text"
          placeholder="e.g. Alien Dictionary, Course Schedule"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={submitting}
          className="sm:col-span-6 bg-surface-muted border border-border-subtle px-3 py-2 text-xs rounded-xl text-foreground focus:outline-none focus:border-accent font-mono placeholder:text-muted-foreground"
        />
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          disabled={submitting}
          className="sm:col-span-2 bg-surface-muted border border-border-subtle px-2 py-2 text-xs rounded-xl text-foreground focus:outline-none focus:border-accent cursor-pointer"
        >
          <option value="LeetCode">LeetCode</option>
          <option value="Codeforces">CF</option>
          <option value="GFG">GFG</option>
          <option value="Custom">Custom</option>
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          disabled={submitting}
          className="sm:col-span-2 bg-surface-muted border border-border-subtle px-2 py-2 text-xs rounded-xl text-foreground focus:outline-none focus:border-accent cursor-pointer"
        >
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </select>
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="sm:col-span-2 bg-accent hover:bg-accent-hover disabled:opacity-50 active:scale-95 text-accent-foreground font-medium text-xs py-2 rounded-xl transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Log
        </button>
      </div>
    </form>
  );
}
