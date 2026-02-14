import { format } from "date-fns";
import { db } from "../data/db";
import { applyStatGains, applyXp, calculateFocusXp, calculateTaskStatGain, calculateTaskXp } from "../domain/progression";
import { updateFocusStreak, updateTaskStreak } from "../domain/streaks";
import type { FocusSession, Task, TaskCompletionReward } from "../domain/types";
import type { AppEvent, EventType } from "./types";
import { applyFocusAnalytics, applyTaskAnalytics } from "../analytics/projections";

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export async function appendEvent<TPayload>(
  userId: string,
  eventType: EventType,
  payload: TPayload
): Promise<AppEvent<TPayload>> {
  const event: AppEvent<TPayload> = {
    eventId: makeId(),
    schemaVersion: 1,
    eventType,
    occurredAt: new Date().toISOString(),
    userId,
    payload
  };

  await db.eventLog.add(event as AppEvent);
  return event;
}

export async function recordTaskCompletion(userId: string, task: Task): Promise<TaskCompletionReward | undefined> {
  const character = await db.character.toCollection().first();
  const streak = (await db.streaks.get("main")) ?? { id: "main", taskDays: 0, focusDays: 0 };
  if (!character) return undefined;

  const today = format(new Date(), "yyyy-MM-dd");
  const sameCategoryCountToday = await db.tasks
    .where("categoryId")
    .equals(task.categoryId)
    .filter((t) => t.completedAt?.startsWith(today) ?? false)
    .count();

  const repeatedTitleCount24h = await db.tasks
    .where("title")
    .equals(task.title)
    .filter((t) => t.completedAt !== undefined)
    .count();

  const category = await db.categories.get(task.categoryId);

  const xp = calculateTaskXp({
    priority: task.priority,
    deadlineSoon: Boolean(task.deadlineAt),
    completedSubtasks: task.subtaskIds.length,
    estimateMinutes: task.estimateMinutes,
    sameCategoryCountToday,
    repeatedTitleCount24h,
    dailyXpBefore: 0,
    level: character.level,
    categoryMultiplier: category?.xpMultiplier ?? 1
  });

  const leveledCharacter = applyXp(character, xp);
  const levelUps = Math.max(0, leveledCharacter.level - character.level);
  const statGains = calculateTaskStatGain(xp, task.priority, category, levelUps);
  const next = { ...applyStatGains(leveledCharacter, statGains), id: character.id };
  await db.character.put(next);

  const updatedStreak = updateTaskStreak(streak, today);
  await db.streaks.put({ id: "main", ...updatedStreak });

  await appendEvent(userId, "TaskCompleted", { taskId: task.id, xp, categoryId: task.categoryId });
  await applyTaskAnalytics(task, xp);

  return {
    xpGain: xp,
    statGains,
    levelBefore: character.level,
    levelAfter: next.level
  };
}

export async function recordFocusSessionEnd(userId: string, session: FocusSession): Promise<void> {
  if (session.type !== "work") {
    return;
  }

  const character = await db.character.toCollection().first();
  const streak = (await db.streaks.get("main")) ?? { id: "main", taskDays: 0, focusDays: 0 };
  if (!character) return;

  const xp = calculateFocusXp(session.durationMin, streak.focusDays);
  const next = { ...applyXp(character, xp), id: character.id };
  await db.character.put(next);

  const today = format(new Date(), "yyyy-MM-dd");
  const updatedStreak = updateFocusStreak(streak, today);
  await db.streaks.put({ id: "main", ...updatedStreak });

  await appendEvent(userId, "FocusSessionEnded", {
    sessionId: session.id,
    taskId: session.taskId,
    categoryId: session.categoryId,
    minutes: session.durationMin,
    xp
  });

  await applyFocusAnalytics(session, xp);
}
