import type { DailyAggregate, Quest, StatKey } from "./types";

interface QuestSignals {
  last14Days: DailyAggregate[];
  neglectedStats: StatKey[];
}

export function generateDailyQuests(signals: QuestSignals): Quest[] {
  const totalFocus = signals.last14Days.reduce((sum, d) => sum + d.focusMinutes, 0);
  const avgFocus = totalFocus / Math.max(1, signals.last14Days.length);

  return [
    {
      id: "dq-focus",
      kind: "daily",
      title: "Shadow Concentration",
      objectiveType: "focus_minutes",
      target: Math.max(25, Math.round(avgFocus * 0.8)),
      progress: 0,
      reward: { xp: 55 },
      status: "active"
    },
    {
      id: "dq-complete",
      kind: "daily",
      title: "Clear the Gate",
      objectiveType: "task_completions",
      target: 3,
      progress: 0,
      reward: { xp: 45 },
      status: "active"
    },
    {
      id: "dq-balance",
      kind: "daily",
      title: `Reinforce ${signals.neglectedStats[0] ?? "discipline"}`,
      objectiveType: "category_balance",
      target: 1,
      progress: 0,
      reward: { xp: 60 },
      status: "active"
    }
  ];
}

export function generateWeeklyQuests(): Quest[] {
  return [
    {
      id: "wq-focus-200",
      kind: "weekly",
      title: "Deep Work Marathon",
      objectiveType: "focus_minutes",
      target: 200,
      progress: 0,
      reward: { xp: 300, currency: 120 },
      status: "active"
    },
    {
      id: "wq-complete-20",
      kind: "weekly",
      title: "Hunter's Sweep",
      objectiveType: "task_completions",
      target: 20,
      progress: 0,
      reward: { xp: 280, cosmeticId: "frame-carbon" },
      status: "active"
    }
  ];
}
