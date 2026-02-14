import { format, startOfWeek } from "date-fns";
import { db } from "../data/db";
import type { DailyAggregate, FocusSession, Task } from "../domain/types";

function dayKey(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd");
}

export async function upsertDailyAggregate(
  occurredAt: string,
  delta: Partial<Pick<DailyAggregate, "focusMinutes" | "completions" | "xpGained">>,
  categoryId?: string,
  categoryFocusMinutes = 0
): Promise<void> {
  const date = dayKey(occurredAt);
  const existing = await db.analyticsDaily.get(date);

  const aggregate: DailyAggregate = existing ?? {
    date,
    focusMinutes: 0,
    completions: 0,
    xpGained: 0,
    categoryFocusMinutes: {}
  };

  aggregate.focusMinutes += delta.focusMinutes ?? 0;
  aggregate.completions += delta.completions ?? 0;
  aggregate.xpGained += delta.xpGained ?? 0;

  if (categoryId && categoryFocusMinutes > 0) {
    aggregate.categoryFocusMinutes[categoryId] =
      (aggregate.categoryFocusMinutes[categoryId] ?? 0) + categoryFocusMinutes;
  }

  await db.analyticsDaily.put(aggregate);
}

export async function getWeekAggregates(referenceDate: Date): Promise<DailyAggregate[]> {
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const start = format(weekStart, "yyyy-MM-dd");
  const end = format(new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");

  return db.analyticsDaily.where("date").between(start, end, true, true).toArray();
}

export async function completionRateOnFocusDays(): Promise<number> {
  const all = await db.analyticsDaily.toArray();
  const focusDays = all.filter((d) => d.focusMinutes > 0);
  if (focusDays.length === 0) return 0;

  const completionDays = focusDays.filter((d) => d.completions > 0).length;
  return Math.round((completionDays / focusDays.length) * 100);
}

export async function peakHourDistribution(): Promise<number[]> {
  const sessions = (await db.focusSessions.toArray()).filter((session) => session.completed);
  const histogram = Array.from({ length: 24 }, () => 0);

  sessions.forEach((s) => {
    const hour = new Date(s.startedAt).getHours();
    histogram[hour] += s.durationMin;
  });

  return histogram;
}

export async function peakDayDistribution(): Promise<number[]> {
  const sessions = await db.focusSessions.toArray();
  const histogram = Array.from({ length: 7 }, () => 0);

  sessions.forEach((s) => {
    const day = new Date(s.startedAt).getDay();
    histogram[day] += s.durationMin;
  });

  return histogram;
}

export async function applyTaskAnalytics(task: Task, xp: number): Promise<void> {
  await upsertDailyAggregate(task.completedAt ?? task.updatedAt, { completions: 1, xpGained: xp });
}

export async function applyFocusAnalytics(session: FocusSession, xp: number): Promise<void> {
  await upsertDailyAggregate(
    session.endedAt ?? session.startedAt,
    { focusMinutes: session.durationMin, xpGained: xp },
    session.categoryId,
    session.durationMin
  );
}
