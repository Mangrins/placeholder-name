import { describe, expect, it } from "vitest";
import { buildSnapshotFromData } from "../snapshot/buildSnapshot";

describe("snapshot builder", () => {
  it("returns stable aggregate-only payload", () => {
    const snapshot = buildSnapshotFromData({
      range: {
        from: "2026-02-10T00:00:00.000Z",
        to: "2026-02-14T23:59:59.999Z"
      },
      character: {
        level: 12,
        xpCurrent: 44,
        xpLifetime: 1500,
        seasonCap: 60,
        prestigeRank: 1,
        legacyPoints: 3,
        stats: { strength: 7, vitality: 8, intellect: 9, creativity: 6, discipline: 10, social: 5 }
      },
      streaks: { taskDays: 4, focusDays: 3, lastTaskDay: "2026-02-14", lastFocusDay: "2026-02-14" },
      daily: [
        {
          date: new Date().toISOString().slice(0, 10),
          focusMinutes: 90,
          completions: 6,
          xpGained: 180,
          categoryFocusMinutes: { learning: 60, health: 30 }
        }
      ],
      events: [
        {
          eventId: "1",
          schemaVersion: 1,
          eventType: "BadgeUnlocked",
          occurredAt: "2026-02-13T09:00:00.000Z",
          userId: "u1",
          payload: { achievementId: "consistency-path-a-silver", rawTaskTitle: "should-not-be-exported" }
        }
      ],
      quests: [
        {
          id: "q1",
          kind: "daily",
          title: "Quest",
          objectiveType: "task_completions",
          target: 10,
          progress: 5,
          reward: { xp: 50 },
          status: "active"
        }
      ]
    });

    expect(snapshot.level).toBe(12);
    expect(snapshot.topCategoriesWeek.length).toBeGreaterThan(0);
    expect(JSON.stringify(snapshot)).not.toContain("rawTaskTitle");
  });
});
