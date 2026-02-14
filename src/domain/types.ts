export type StatKey =
  | "strength"
  | "vitality"
  | "intellect"
  | "creativity"
  | "discipline"
  | "social";

export type Priority = "low" | "medium" | "high";

export type TaskStatus = "todo" | "done";

export interface TaskSubtask {
  id: string;
  title: string;
  done: boolean;
}

export type TaskRecurrence =
  | { kind: "daily_interval"; intervalDays: number }
  | { kind: "weekly_days"; intervalWeeks: number; weekdays: number[] };

export interface Category {
  id: string;
  name: string;
  statWeights: Partial<Record<StatKey, number>>;
  xpMultiplier: number;
  isDefault: boolean;
}

export interface Task {
  id: string;
  title: string;
  categoryId: string;
  status: TaskStatus;
  priority: Priority;
  deadlineAt?: string;
  recurrenceRule?: string;
  estimateMinutes: number;
  tags: string[];
  notes: string;
  subtaskIds: string[];
  subtasks?: TaskSubtask[];
  parentTaskId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  recurrence?: TaskRecurrence;
  completionReward?: Pick<TaskCompletionReward, "xpGain" | "statGains">;
}

export interface FocusSession {
  id: string;
  label?: string;
  taskId?: string;
  categoryId?: string;
  startedAt: string;
  endedAt?: string;
  durationMin: number;
  rewardMinutes?: number;
  type: "work" | "break" | "long_break";
  completed: boolean;
}

export interface CharacterState {
  level: number;
  xpCurrent: number;
  xpLifetime: number;
  seasonCap: number;
  prestigeRank: number;
  legacyPoints: number;
  stats: Record<StatKey, number>;
}

export type StatDelta = Partial<Record<StatKey, number>>;

export interface TaskCompletionReward {
  xpGain: number;
  statGains: StatDelta;
  levelBefore: number;
  levelAfter: number;
}

export interface Reward {
  xp: number;
  currency?: number;
  cosmeticId?: string;
}

export type QuestKind = "daily" | "weekly" | "storyline" | "boss";

export interface Quest {
  id: string;
  kind: QuestKind;
  title: string;
  objectiveType: "focus_minutes" | "task_completions" | "category_balance";
  objectiveCategoryId?: string;
  target: number;
  progress: number;
  reward: Reward;
  expiresAt?: string;
  status: "active" | "complete";
}

export type AchievementTier = "bronze" | "silver" | "gold" | "legendary";

export interface Achievement {
  id: string;
  category:
    | "consistency"
    | "deep_work"
    | "balance"
    | "mastery"
    | "exploration"
    | "recovery"
    | "social"
    | "health";
  chain: string;
  tier: AchievementTier;
  title: string;
  requirementType: "focus_minutes_total" | "task_streak" | "tasks_completed";
  requirementValue: number;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  title: string;
  avatarId: string;
  cosmetics: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StreakState {
  taskDays: number;
  focusDays: number;
  lastTaskDay?: string;
  lastFocusDay?: string;
}

export interface DailyAggregate {
  date: string;
  focusMinutes: number;
  completions: number;
  xpGained: number;
  categoryFocusMinutes: Record<string, number>;
}

export interface AppSettings {
  timer: {
    workMin: number;
    breakMin: number;
    longBreakMin: number;
    everyN: number;
  };
  themeId?: "neon" | "pastel_light" | "monochrome" | "ember" | "oceanic" | "medieval";
  staminaEnabled: boolean;
  audioEnabled: boolean;
  reducedMotion: boolean;
}

export interface AchievementProgress {
  id: string;
  value: number;
  unlockedAt?: string;
}
