import type { StudentRoutine, DailyFocus, BacklogTask } from "../../types/index.ts";
import { getLocalDateString } from "../dateUtils.ts";
import { STORAGE_KEYS } from "./keys.ts";

interface RolloverResult {
  rolledOver: boolean;
  previousDate: string;
  currentDate: string;
}

/**
 * Checks if the calendar day has changed since the last recorded rollover.
 * If so:
 * 1. Resets daily routine checkmarks for routines completed on prior days.
 * 2. Archives completed focus tasks into kanso_focus_history.
 * 3. Carries forward unfinished focus tasks into today's focus slots (up to 3 slots).
 *    Any extra unfinished tasks exceeding 3 slots are safely moved to the backlog (kanso_tasks).
 * 4. Records the last rollover date and broadcasts kanso-storage-updated.
 */
export function checkAndApplyRollover(force: boolean = false): RolloverResult {
  if (typeof window === "undefined") {
    return { rolledOver: false, previousDate: "", currentDate: getLocalDateString() };
  }

  const currentDate = getLocalDateString();
  const previousDate = localStorage.getItem(STORAGE_KEYS.LAST_ROLLOVER_DATE) || "";

  if (!force && previousDate === currentDate) {
    return { rolledOver: false, previousDate, currentDate };
  }

  try {
    // 1. Reset daily routine checkmarks if they were completed on a previous day
    const rawRoutines = localStorage.getItem(STORAGE_KEYS.ROUTINES);
    if (rawRoutines) {
      const routines: StudentRoutine[] = JSON.parse(rawRoutines);
      if (Array.isArray(routines)) {
        let routinesModified = false;

        const updatedRoutines = routines.map((r) => {
          if (r.is_completed_today && r.last_completed_date !== currentDate) {
            routinesModified = true;
            return {
              ...r,
              is_completed_today: false,
            };
          }
          return r;
        });

        if (routinesModified) {
          localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(updatedRoutines));
        }
      }
    }

    // 2. Process focus tasks: archive completed history and carry forward unfinished
    const rawFocus = localStorage.getItem(STORAGE_KEYS.FOCUS);
    if (rawFocus) {
      const focusTasks: DailyFocus[] = JSON.parse(rawFocus);
      if (Array.isArray(focusTasks)) {
        const todayTasks: DailyFocus[] = [];
        const pastCompleted: DailyFocus[] = [];
        const pastUnfinished: DailyFocus[] = [];

        for (const task of focusTasks) {
          if (task.target_date === currentDate) {
            todayTasks.push(task);
          } else if (task.is_completed) {
            pastCompleted.push(task);
          } else {
            pastUnfinished.push(task);
          }
        }

        // Archive completed past tasks into kanso_focus_history
        if (pastCompleted.length > 0) {
          let existingHistory: DailyFocus[] = [];
          try {
            const rawHistory = localStorage.getItem(STORAGE_KEYS.FOCUS_HISTORY);
            if (rawHistory) {
              const parsed = JSON.parse(rawHistory);
              if (Array.isArray(parsed)) existingHistory = parsed;
            }
          } catch {}

          const historyIds = new Set(existingHistory.map((h) => h.id));
          const newEntries = pastCompleted.filter((t) => !historyIds.has(t.id));
          if (newEntries.length > 0) {
            localStorage.setItem(
              STORAGE_KEYS.FOCUS_HISTORY,
              JSON.stringify([...existingHistory, ...newEntries])
            );
          }
        }

        // Carry forward or backlog unfinished past tasks
        if (pastUnfinished.length > 0) {
          const takenSlots = new Set(todayTasks.map((t) => t.priority_order));
          const overflowToBacklog: DailyFocus[] = [];

          for (const task of pastUnfinished) {
            let assignedSlot: number | null = null;
            if (!takenSlots.has(task.priority_order) && task.priority_order >= 1 && task.priority_order <= 3) {
              assignedSlot = task.priority_order;
            } else {
              for (const slot of [1, 2, 3]) {
                if (!takenSlots.has(slot)) {
                  assignedSlot = slot;
                  break;
                }
              }
            }

            if (assignedSlot !== null) {
              takenSlots.add(assignedSlot);
              todayTasks.push({
                ...task,
                target_date: currentDate,
                priority_order: assignedSlot,
              });
            } else {
              overflowToBacklog.push(task);
            }
          }

          if (overflowToBacklog.length > 0) {
            let backlog: BacklogTask[] = [];
            try {
              const rawBacklog = localStorage.getItem(STORAGE_KEYS.TASKS);
              if (rawBacklog) {
                const parsed = JSON.parse(rawBacklog);
                if (Array.isArray(parsed)) backlog = parsed;
              }
            } catch {}

            const newBacklogItems: BacklogTask[] = overflowToBacklog.map((t) => ({
              id: `rollover-${t.id}-${Date.now()}`,
              title: t.title,
              category: "Focus",
              priority: t.priority_order === 1 ? "High" : t.priority_order === 2 ? "Medium" : "Low",
              dueDate: currentDate,
              isCompleted: false,
              createdAt: t.created_at || new Date().toISOString(),
            }));

            localStorage.setItem(
              STORAGE_KEYS.TASKS,
              JSON.stringify([...backlog, ...newBacklogItems])
            );
          }
        }

        todayTasks.sort((a, b) => a.priority_order - b.priority_order);
        localStorage.setItem(STORAGE_KEYS.FOCUS, JSON.stringify(todayTasks));
      }
    }

    // 3. Update last rollover date
    localStorage.setItem(STORAGE_KEYS.LAST_ROLLOVER_DATE, currentDate);

    // 4. Notify app components that rollover occurred
    window.dispatchEvent(
      new CustomEvent("kanso-storage-updated", {
        detail: { key: STORAGE_KEYS.LAST_ROLLOVER_DATE, date: currentDate },
      })
    );

    return { rolledOver: true, previousDate, currentDate };
  } catch (err) {
    console.warn("Kanso rollover error:", err);
    return { rolledOver: false, previousDate, currentDate };
  }
}

