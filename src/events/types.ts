export type EventType =
  | "TaskCreated"
  | "TaskUpdated"
  | "TaskCompleted"
  | "TaskReopened"
  | "TaskDeleted"
  | "FocusSessionStarted"
  | "FocusSessionEnded"
  | "QuestGenerated"
  | "QuestCompleted"
  | "AchievementProgressed"
  | "BadgeUnlocked"
  | "PerkUnlocked"
  | "LevelUp"
  | "PrestigeTriggered"
  | "CategoryCreated"
  | "SettingsUpdated";

export interface AppEvent<TPayload = unknown> {
  eventId: string;
  schemaVersion: number;
  eventType: EventType;
  occurredAt: string;
  userId: string;
  payload: TPayload;
}

export interface SnapshotRange {
  from: string;
  to: string;
}

export interface SocialSnapshot {
  level: number;
  prestigeRank: number;
  xpToday: number;
  xpWeek: number;
  focusMinutesToday: number;
  focusMinutesWeek: number;
  completionsToday: number;
  completionsWeek: number;
  taskStreak: number;
  focusStreak: number;
  topCategoriesWeek: Array<{ category: string; percentage: number }>;
  lastBadgeUnlocked?: string;
  activeQuestProgressPercent: number;
}
