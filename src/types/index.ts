export interface CodingLog {
  id: number;
  problem_title: string;
  platform: string;
  difficulty: "Easy" | "Medium" | "Hard" | string;
  topic_tag: string;
  problem_url?: string | null;
  time_spent_mins?: number | null;
  solved_at: string;
  created_at: string;
}

export interface CodingLogUpdate {
  problem_title?: string;
  platform?: string;
  difficulty?: string;
  topic_tag?: string;
  problem_url?: string | null;
  time_spent_mins?: number | null;
  solved_at?: string;
}

export interface HeatmapDay {
  date: string;
  count: number;
}

export interface DailyFocus {
  id: number;
  title: string;
  target_date: string;
  priority_order: number;
  is_completed: boolean;
  created_at: string;
}

export interface StudentRoutine {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  category: string;
  scheduled_date?: string | null;
  is_completed_today: boolean;
  last_completed_date?: string | null;
  created_at: string;
}

export interface UserStats {
  id: number;
  xp: number;
  level: number;
  current_streak_days: number;
  longest_streak_days: number;
  last_active_date?: string | null;
}

export interface FocusSession {
  id: number;
  duration_seconds: number;
  session_type: string;
  target_date: string;
  xp_earned: number;
  completed_at: string;
}

export interface FocusDayStat {
  date: string;
  focus_minutes: number;
  sessions_count: number;
}

export interface FocusStats {
  total_focus_minutes: number;
  today_focus_minutes: number;
  total_sessions: number;
  daily_stats: FocusDayStat[];
}

export interface PlatformStat {
  platform: string;
  count: number;
  color: string;
}

export interface DifficultyStat {
  difficulty: string;
  count: number;
  color: string;
}

export interface CodingAnalytics {
  total_solved: number;
  platform_breakdown: PlatformStat[];
  difficulty_breakdown: DifficultyStat[];
}

export interface CodingSyncResult {
  platform: string;
  handle: string;
  total_solved: number;
  easy_solved: number;
  medium_solved: number;
  hard_solved: number;
  rating?: number | null;
  rank?: string | null;
  synced_problems_count: number;
  message: string;
}

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
  date?: string;
  updatedAt: string;
}