import { endOfDay, format, parseISO, startOfDay, subDays } from "date-fns";
import { db } from "../data/db";
import type { SnapshotRange, SocialSnapshot } from "../events/types";
import type { CharacterState, DailyAggregate, Quest, StreakState } from "../domain/types";
import type { AppEvent } from "../events/types";

function isInRange(dateIso: string, range: SnapshotRange): boolean {
  const value = parseISO(dateIso).getTime();
  return value >= parseISO(range.from).getTime() && value <= parseISO(range.to).getTime();
}

export async function buildSnapshot(range: SnapshotRange): Promise<SocialSnapshot> {
  const [character, streaks, daily, events, quests] = await Promise.all([
    db.character.toCollection().first(),
    db.streaks.get("main"),
    db.analyticsDaily.toArray(),
    db.eventLog.toArray(),
    db.quests.where("status").equals("active").toArray()
  ]);

  return buildSnapshotFromData({
    range,
    character,
    streaks,
    daily,
    events,
    quests
  });
}

export function todayRange(): SnapshotRange {
  const now = new Date();
  return {
    from: startOfDay(now).toISOString(),
    to: endOfDay(now).toISOString()
  };
}

interface SnapshotInput {
  range: SnapshotRange;
  character?: CharacterState;
  streaks?: StreakState;
  daily: DailyAggregate[];
  events: AppEvent[];
  quests: Quest[];
}

export function buildSnapshotFromData(input: SnapshotInput): SocialSnapshot {
  const today = format(new Date(), "yyyy-MM-dd");
  const weekFrom = format(subDays(new Date(), 6), "yyyy-MM-dd");

  const todayAggregate = input.daily.find((d) => d.date === today);
  const weekAggregates = input.daily.filter((d) => d.date >= weekFrom && d.date <= today);

  const totalCategoryWeek = weekAggregates.reduce((map, d) => {
    Object.entries(d.categoryFocusMinutes).forEach(([category, minutes]) => {
      map[category] = (map[category] ?? 0) + minutes;
    });
    return map;
  }, {} as Record<string, number>);

  const categoryTotalMinutes = Object.values(totalCategoryWeek).reduce((sum, v) => sum + v, 0);
  const topCategoriesWeek = Object.entries(totalCategoryWeek)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, minutes]) => ({
      category,
      percentage: categoryTotalMinutes === 0 ? 0 : Math.round((minutes / categoryTotalMinutes) * 100)
    }));

  const lastBadge = input.events
    .filter((e) => e.eventType === "BadgeUnlocked" && isInRange(e.occurredAt, input.range))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];

  const activeQuestProgressPercent = input.quests.length
    ? Math.round(
        input.quests.reduce((sum, q) => sum + Math.min(1, q.progress / Math.max(1, q.target)), 0) *
          (100 / input.quests.length)
      )
    : 0;

  return {
    level: input.character?.level ?? 1,
    prestigeRank: input.character?.prestigeRank ?? 0,
    xpToday: todayAggregate?.xpGained ?? 0,
    xpWeek: weekAggregates.reduce((sum, d) => sum + d.xpGained, 0),
    focusMinutesToday: todayAggregate?.focusMinutes ?? 0,
    focusMinutesWeek: weekAggregates.reduce((sum, d) => sum + d.focusMinutes, 0),
    completionsToday: todayAggregate?.completions ?? 0,
    completionsWeek: weekAggregates.reduce((sum, d) => sum + d.completions, 0),
    taskStreak: input.streaks?.taskDays ?? 0,
    focusStreak: input.streaks?.focusDays ?? 0,
    topCategoriesWeek,
    lastBadgeUnlocked: (lastBadge?.payload as { achievementId?: string } | undefined)?.achievementId,
    activeQuestProgressPercent
  };
}
