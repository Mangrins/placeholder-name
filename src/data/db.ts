import Dexie, { type Table } from "dexie";
import type {
  Achievement,
  AchievementProgress,
  AppSettings,
  Category,
  CharacterState,
  DailyAggregate,
  FocusSession,
  Quest,
  StreakState,
  Task,
  UserProfile
} from "../domain/types";
import type { AppEvent } from "../events/types";

export class RPGDatabase extends Dexie {
  userProfile!: Table<UserProfile, string>;
  settings!: Table<AppSettings & { id: string }, string>;
  categories!: Table<Category, string>;
  tasks!: Table<Task, string>;
  focusSessions!: Table<FocusSession, string>;
  character!: Table<CharacterState & { id: string }, string>;
  quests!: Table<Quest, string>;
  achievements!: Table<Achievement, string>;
  achievementProgress!: Table<AchievementProgress, string>;
  streaks!: Table<StreakState & { id: "main" }, string>;
  analyticsDaily!: Table<DailyAggregate, string>;
  eventLog!: Table<AppEvent, string>;

  constructor() {
    super("rpg-productivity-db");

    this.version(1).stores({
      userProfile: "userId, updatedAt",
      settings: "id",
      categories: "id, name",
      tasks: "id, title, status, categoryId, deadlineAt, updatedAt, completedAt",
      focusSessions: "id, startedAt, endedAt, categoryId, taskId",
      character: "id, level",
      quests: "id, kind, status, expiresAt",
      achievements: "id, category, tier",
      achievementProgress: "id, unlockedAt",
      streaks: "id, lastTaskDay, lastFocusDay",
      analyticsDaily: "date",
      eventLog: "eventId, occurredAt, eventType, schemaVersion, userId"
    });
  }
}

export const db = new RPGDatabase();
