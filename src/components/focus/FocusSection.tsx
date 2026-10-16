"use client";

import { Target, Trophy } from "lucide-react";
import { DailyFocus } from "@/types";
import DailyFocusCard from "./DailyFocusCard";

interface FocusSectionProps {
  tasks: DailyFocus[];
  onSave: (priority: number, title: string) => Promise<void>;
  onToggle: (item: DailyFocus) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export default function FocusSection({
  tasks,
  onSave,
  onToggle,
  onDelete,
}: FocusSectionProps) {
  const getSlot = (p: number) => tasks.find((t) => t.priority_order === p);
  const completedCount = tasks.filter((t) => t.is_completed).length;

  return (
    <div className="bg-surface border border-border-subtle rounded-2xl p-4 sm:p-5 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold uppercase tracking-wider font-mono text-foreground flex items-center gap-2">
          <Target className="w-4 h-4 text-accent" /> Rule of 3 • Daily Focus
        </h2>
        {completedCount === 3 ? (
          <span className="flex items-center gap-1 text-[11px] font-mono bg-accent-subtle text-accent border border-accent px-2.5 py-0.5 rounded-md font-semibold">
            <Trophy className="w-3 h-3" /> Day Complete
          </span>
        ) : (
          <span className="text-[10px] font-mono text-muted-foreground">
            {completedCount}/3 Done
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {[1, 2, 3].map((slot) => (
          <DailyFocusCard
            key={slot}
            slotNumber={slot}
            item={getSlot(slot)}
            onSave={onSave}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
