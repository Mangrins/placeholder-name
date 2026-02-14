import { create } from "zustand";
import { db } from "./db";
import { ensureUserProfile } from "./identity";
import { bootstrapData } from "./bootstrap";
import { appendEvent, recordFocusSessionEnd, recordTaskCompletion } from "../events/eventService";
import { upsertDailyAggregate } from "../analytics/projections";
import { removeXp, revertStatGains } from "../domain/progression";
import type { AppEvent } from "../events/types";
import type {
  Achievement,
  AchievementProgress,
  AppSettings,
  Category,
  CharacterState,
  FocusSession,
  Quest,
  StreakState,
  Task,
  TaskCompletionReward,
  UserProfile
} from "../domain/types";

interface TaskCreateInput extends Omit<Task, "id" | "createdAt" | "updatedAt" | "status"> {}

interface CustomQuestInput {
  title: string;
  kind: Quest["kind"];
  objectiveType: Quest["objectiveType"];
  target: number;
  rewardXp: number;
  objectiveCategoryId?: string;
}

interface AppState {
  ready: boolean;
  profile?: UserProfile;
  tasks: Task[];
  categories: Category[];
  quests: Quest[];
  achievements: Achievement[];
  achievementProgress: Record<string, AchievementProgress>;
  settings?: AppSettings;
  streaks?: StreakState;
  character?: CharacterState;
  activeTab: string;
  init: () => Promise<void>;
  setActiveTab: (tab: string) => void;
  createTask: (task: TaskCreateInput) => Promise<void>;
  updateTask: (taskId: string, patch: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<TaskCompletionReward | undefined>;
  reopenTask: (taskId: string) => Promise<void>;
  createQuest: (quest: CustomQuestInput) => Promise<void>;
  updateQuest: (questId: string, patch: Partial<Quest>) => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  updateTimerSettings: (patch: Partial<AppSettings["timer"]>) => Promise<void>;
  resetLifetimeXp: () => Promise<void>;
  addFocusSession: (session: FocusSession, options?: { applyRewards?: boolean }) => Promise<void>;
  appendEvent: (event: Omit<AppEvent, "eventId" | "occurredAt" | "schemaVersion">) => Promise<void>;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function toDateOnly(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function withTimeFrom(source: Date, target: Date): Date {
  const next = new Date(target);
  next.setHours(source.getHours(), source.getMinutes(), source.getSeconds(), source.getMilliseconds());
  return next;
}

function recurrenceLabel(task: Task): string | undefined {
  if (!task.recurrence) return task.recurrenceRule;
  if (task.recurrence.kind === "daily_interval") {
    const n = Math.max(1, Math.round(task.recurrence.intervalDays));
    return n === 1 ? "Every day" : `Every ${n} days`;
  }

  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const every = Math.max(1, Math.round(task.recurrence.intervalWeeks));
  const days = [...task.recurrence.weekdays].sort((a, b) => a - b).map((day) => labels[day] ?? "");
  const dayText = days.filter(Boolean).join(", ");
  return every === 1 ? `Weekly: ${dayText}` : `Every ${every} weeks: ${dayText}`;
}

function nextRecurringDeadline(task: Task, completedAtIso: string): string | undefined {
  const recurrence = task.recurrence;
  if (!recurrence) return undefined;

  const base = task.deadlineAt ? new Date(task.deadlineAt) : new Date(completedAtIso);
  const from = new Date(completedAtIso);

  if (Number.isNaN(base.getTime()) || Number.isNaN(from.getTime())) return undefined;

  if (recurrence.kind === "daily_interval") {
    const intervalDays = Math.max(1, Math.round(recurrence.intervalDays));
    const next = withTimeFrom(base, new Date(base.getTime() + intervalDays * 24 * 60 * 60 * 1000));
    return next.toISOString();
  }

  if (recurrence.kind === "weekly_days") {
    const intervalWeeks = Math.max(1, Math.round(recurrence.intervalWeeks));
    const weekdays = [...new Set(recurrence.weekdays.filter((day) => day >= 0 && day <= 6))].sort((a, b) => a - b);
    if (weekdays.length === 0) return undefined;

    const anchor = toDateOnly(base);
    anchor.setDate(anchor.getDate() - anchor.getDay());

    for (let cycle = 0; cycle < 80; cycle += 1) {
      const weekStart = new Date(anchor);
      weekStart.setDate(anchor.getDate() + cycle * intervalWeeks * 7);
      for (const weekday of weekdays) {
        const candidateDate = new Date(weekStart);
        candidateDate.setDate(weekStart.getDate() + weekday);
        const candidate = withTimeFrom(base, candidateDate);
        if (candidate.getTime() > from.getTime()) {
          return candidate.toISOString();
        }
      }
    }
  }

  return undefined;
}

function toProgressRecord(rows: AchievementProgress[]): Record<string, AchievementProgress> {
  return rows.reduce<Record<string, AchievementProgress>>((acc, row) => {
    acc[row.id] = row;
    return acc;
  }, {});
}

async function syncQuestProgress(): Promise<Quest[]> {
  const [quests, tasks, sessions] = await Promise.all([
    db.quests.toArray(),
    db.tasks.toArray(),
    db.focusSessions.toArray()
  ]);

  const completedTasks = tasks.filter((task) => task.status === "done");
  const completedTaskCount = completedTasks.length;
  const completedFocusMinutes = sessions
    .filter((session) => session.type === "work")
    .reduce((sum, session) => sum + session.durationMin, 0);

  const completedByCategory = completedTasks.reduce<Record<string, number>>((acc, task) => {
    acc[task.categoryId] = (acc[task.categoryId] ?? 0) + 1;
    return acc;
  }, {});

  const updates: Quest[] = [];
  for (const quest of quests) {
    let rawProgress = 0;
    if (quest.objectiveType === "task_completions") {
      rawProgress = completedTaskCount;
    } else if (quest.objectiveType === "focus_minutes") {
      rawProgress = completedFocusMinutes;
    } else if (quest.objectiveType === "category_balance") {
      if (quest.objectiveCategoryId) {
        rawProgress = completedByCategory[quest.objectiveCategoryId] ?? 0;
      } else {
        rawProgress = Object.keys(completedByCategory).length;
      }
    }

    const progress = Math.min(quest.target, rawProgress);
    const status: Quest["status"] = progress >= quest.target ? "complete" : "active";
    if (progress !== quest.progress || status !== quest.status) {
      updates.push({ ...quest, progress, status });
    }
  }

  if (updates.length > 0) {
    await db.quests.bulkPut(updates);
  }

  return updates.length > 0 ? db.quests.toArray() : quests;
}

async function syncAchievementProgress(): Promise<Record<string, AchievementProgress>> {
  const [achievements, progressRows, streak, tasks, sessions] = await Promise.all([
    db.achievements.toArray(),
    db.achievementProgress.toArray(),
    db.streaks.get("main"),
    db.tasks.toArray(),
    db.focusSessions.toArray()
  ]);

  const progressMap = toProgressRecord(progressRows);
  const completedTasks = tasks.filter((task) => task.status === "done").length;
  const focusMinutesTotal = sessions
    .filter((session) => session.type === "work")
    .reduce((sum, session) => sum + session.durationMin, 0);
  const taskStreak = streak?.taskDays ?? 0;

  const nextRows: AchievementProgress[] = [];
  const now = new Date().toISOString();

  for (const achievement of achievements) {
    let value = 0;
    if (achievement.requirementType === "tasks_completed") {
      value = completedTasks;
    } else if (achievement.requirementType === "focus_minutes_total") {
      value = focusMinutesTotal;
    } else {
      value = taskStreak;
    }

    const existing = progressMap[achievement.id];
    const unlockedAt = existing?.unlockedAt ?? (value >= achievement.requirementValue ? now : undefined);
    if (!existing || existing.value !== value || existing.unlockedAt !== unlockedAt) {
      nextRows.push({ id: achievement.id, value, unlockedAt });
    }
  }

  if (nextRows.length > 0) {
    await db.achievementProgress.bulkPut(nextRows);
  }

  const merged = await db.achievementProgress.toArray();
  return toProgressRecord(merged);
}

async function loadStateData(): Promise<{
  profile: UserProfile;
  tasks: Task[];
  categories: Category[];
  quests: Quest[];
  character?: CharacterState;
  achievements: Achievement[];
  settings?: AppSettings;
  streaks?: StreakState;
  achievementProgress: Record<string, AchievementProgress>;
}> {
  const profile = await ensureUserProfile();
  const [tasks, categories, quests, character, achievements, settings, streaks, achievementProgress] =
    await Promise.all([
      db.tasks.orderBy("updatedAt").reverse().toArray(),
      db.categories.toArray(),
      db.quests.toArray(),
      db.character.toCollection().first(),
      db.achievements.toArray(),
      db.settings.get("main"),
      db.streaks.get("main"),
      db.achievementProgress.toArray()
    ]);

  return {
    profile,
    tasks,
    categories,
    quests,
    character,
    achievements,
    settings,
    streaks,
    achievementProgress: toProgressRecord(achievementProgress)
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  tasks: [],
  categories: [],
  quests: [],
  achievements: [],
  achievementProgress: {},
  activeTab: "dashboard",

  init: async () => {
    await bootstrapData();
    await syncQuestProgress();
    await syncAchievementProgress();

    const data = await loadStateData();
    set({ ready: true, ...data });
  },

  setActiveTab: (activeTab) => set({ activeTab }),

  createTask: async (input) => {
    const now = new Date().toISOString();
    const profile = get().profile;
    if (!profile) return;

    const task: Task = {
      ...input,
      id: makeId(),
      status: "todo",
      createdAt: now,
      updatedAt: now
    };

    await db.tasks.add(task);
    await appendEvent(profile.userId, "TaskCreated", { taskId: task.id, categoryId: task.categoryId });

    const tasks = await db.tasks.orderBy("updatedAt").reverse().toArray();
    set({ tasks });
  },

  updateTask: async (taskId, patch) => {
    const profile = get().profile;
    if (!profile) return;

    const task = await db.tasks.get(taskId);
    if (!task) return;

    const updated: Task = {
      ...task,
      ...patch,
      id: task.id,
      createdAt: task.createdAt,
      updatedAt: new Date().toISOString()
    };
    await db.tasks.put(updated);
    await appendEvent(profile.userId, "TaskUpdated", { taskId, patchKeys: Object.keys(patch) });

    const tasks = await db.tasks.orderBy("updatedAt").reverse().toArray();
    set({ tasks });
  },

  deleteTask: async (taskId) => {
    const profile = get().profile;
    if (!profile) return;

    const task = await db.tasks.get(taskId);
    if (!task) return;

    await db.tasks.delete(taskId);
    await appendEvent(profile.userId, "TaskDeleted", { taskId });

    const [tasks, quests, achievementProgress] = await Promise.all([
      db.tasks.orderBy("updatedAt").reverse().toArray(),
      syncQuestProgress(),
      syncAchievementProgress()
    ]);
    set({ tasks, quests, achievementProgress });
  },

  completeTask: async (taskId) => {
    const now = new Date().toISOString();
    const profile = get().profile;
    if (!profile) return;

    const task = await db.tasks.get(taskId);
    if (!task || task.status === "done") return;

    const updated: Task = { ...task, status: "done", completedAt: now, updatedAt: now };
    const reward = await recordTaskCompletion(profile.userId, updated);
    const completionReward =
      reward && reward.xpGain > 0 ? { xpGain: reward.xpGain, statGains: reward.statGains } : undefined;
    const completedTask: Task = { ...updated, completionReward };
    await db.tasks.put(completedTask);

    if (completedTask.recurrence) {
      const nextDeadline = nextRecurringDeadline(completedTask, now);
      const clonedSubtasks = (completedTask.subtasks ?? []).map((subtask) => ({
        ...subtask,
        id: makeId(),
        done: false
      }));
      const nextTask: Task = {
        ...completedTask,
        id: makeId(),
        status: "todo",
        createdAt: now,
        updatedAt: now,
        completedAt: undefined,
        completionReward: undefined,
        deadlineAt: nextDeadline,
        recurrenceRule: recurrenceLabel(completedTask),
        subtaskIds: clonedSubtasks.map((subtask) => subtask.id),
        subtasks: clonedSubtasks
      };
      await db.tasks.add(nextTask);
    }

    const [tasks, character, streaks, quests, achievementProgress] = await Promise.all([
      db.tasks.orderBy("updatedAt").reverse().toArray(),
      db.character.toCollection().first(),
      db.streaks.get("main"),
      syncQuestProgress(),
      syncAchievementProgress()
    ]);
    set({ tasks, character, streaks, quests, achievementProgress });
    return reward;
  },

  reopenTask: async (taskId) => {
    const profile = get().profile;
    if (!profile) return;

    const task = await db.tasks.get(taskId);
    if (!task || task.status !== "done") return;

    const completedAt = task.completedAt;
    const completionReward = task.completionReward;

    if (completionReward) {
      const character = await db.character.toCollection().first();
      if (character) {
        const reverted = {
          ...revertStatGains(removeXp(character, completionReward.xpGain), completionReward.statGains),
          id: character.id
        };
        await db.character.put(reverted);
      }
    }

    const updated: Task = {
      ...task,
      status: "todo",
      completedAt: undefined,
      completionReward: undefined,
      updatedAt: new Date().toISOString()
    };
    await db.tasks.put(updated);
    if (completedAt) {
      await upsertDailyAggregate(completedAt, {
        completions: -1,
        xpGained: completionReward?.xpGain ? -completionReward.xpGain : 0
      });
    }
    await appendEvent(profile.userId, "TaskReopened", { taskId });

    const [tasks, character, quests, achievementProgress] = await Promise.all([
      db.tasks.orderBy("updatedAt").reverse().toArray(),
      db.character.toCollection().first(),
      syncQuestProgress(),
      syncAchievementProgress()
    ]);
    set({ tasks, character, quests, achievementProgress });
  },

  createQuest: async (questInput) => {
    const profile = get().profile;
    if (!profile) return;

    const quest: Quest = {
      id: makeId(),
      kind: questInput.kind,
      title: questInput.title,
      objectiveType: questInput.objectiveType,
      objectiveCategoryId: questInput.objectiveCategoryId,
      target: Math.max(1, Math.round(questInput.target)),
      progress: 0,
      reward: { xp: Math.max(1, Math.round(questInput.rewardXp)) },
      status: "active"
    };

    await db.quests.add(quest);
    await appendEvent(profile.userId, "QuestGenerated", {
      questId: quest.id,
      objectiveType: quest.objectiveType,
      target: quest.target
    });

    const quests = await syncQuestProgress();
    set({ quests });
  },

  updateQuest: async (questId, patch) => {
    const profile = get().profile;
    if (!profile) return;

    const quest = await db.quests.get(questId);
    if (!quest) return;

    const updated: Quest = {
      ...quest,
      ...patch,
      id: quest.id,
      target: Math.max(1, Math.round((patch.target ?? quest.target) || 1))
    };
    await db.quests.put(updated);
    if (updated.status === "complete") {
      await appendEvent(profile.userId, "QuestCompleted", { questId: updated.id });
    }

    const quests = await db.quests.toArray();
    set({ quests });
  },

  updateSettings: async (patch) => {
    const existing = await db.settings.get("main");
    if (!existing) return;

    const next: AppSettings & { id: string } = {
      ...existing,
      ...patch,
      timer: {
        ...existing.timer,
        ...(patch.timer ?? {})
      }
    };
    await db.settings.put(next);
    set({ settings: next });
  },

  updateTimerSettings: async (patch) => {
    const existing = await db.settings.get("main");
    if (!existing) return;

    const next: AppSettings & { id: string } = {
      ...existing,
      timer: {
        ...existing.timer,
        ...patch
      }
    };
    await db.settings.put(next);
    set({ settings: next });
  },

  resetLifetimeXp: async () => {
    const character = await db.character.toCollection().first();
    if (!character) return;
    const next = { ...character, xpLifetime: 0, id: character.id };
    await db.character.put(next);
    set({ character: next });
  },

  addFocusSession: async (session, options) => {
    const profile = get().profile;
    if (!profile) return;

    await db.focusSessions.add(session);
    if (options?.applyRewards === false) {
      if (session.type === "work") {
        await upsertDailyAggregate(
          session.endedAt ?? session.startedAt,
          { focusMinutes: session.durationMin },
          session.categoryId,
          session.durationMin
        );
      }
      return;
    }

    await recordFocusSessionEnd(profile.userId, session);

    const [character, streaks, quests, achievementProgress] = await Promise.all([
      db.character.toCollection().first(),
      db.streaks.get("main"),
      syncQuestProgress(),
      syncAchievementProgress()
    ]);
    set({ character, streaks, quests, achievementProgress });
  },

  appendEvent: async (event) => {
    await appendEvent(event.userId, event.eventType, event.payload);
  }
}));
