"use client";

import {
  Code2,
  Timer,
  CheckSquare,
  BarChart3,
  Settings,
} from "lucide-react";

export type NavTab = "arena" | "focus" | "tasks" | "stats" | "settings";

interface MobileNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export default function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  const tabs = [
    { id: "arena", label: "Arena", icon: Code2 },
    { id: "focus", label: "Focus", icon: Timer },
    { id: "tasks", label: "Plan", icon: CheckSquare },
    { id: "stats", label: "Stats", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings },
  ] as const;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-md border-t border-border-subtle px-3 py-2 pb-5 shadow-lg">
      <div className="flex items-center justify-around">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`flex flex-col items-center gap-1 transition px-2 py-1 cursor-pointer ${
                isActive
                  ? "text-accent font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] font-mono">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
