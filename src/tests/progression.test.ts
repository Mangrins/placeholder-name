import { describe, expect, it } from "vitest";
import { applyXp, calculateTaskXp, prestige, xpToNext } from "../domain/progression";

describe("progression formulas", () => {
  it("applies diminishing returns and anti-spam penalties", () => {
    const baseline = calculateTaskXp({
      priority: "medium",
      deadlineSoon: false,
      completedSubtasks: 0,
      estimateMinutes: 30,
      sameCategoryCountToday: 0,
      repeatedTitleCount24h: 0,
      dailyXpBefore: 0,
      level: 1
    });

    const penalized = calculateTaskXp({
      priority: "medium",
      deadlineSoon: false,
      completedSubtasks: 0,
      estimateMinutes: 3,
      sameCategoryCountToday: 4,
      repeatedTitleCount24h: 3,
      dailyXpBefore: 0,
      level: 1
    });

    expect(penalized).toBeLessThan(baseline);
  });

  it("levels up correctly and carries overflow xp", () => {
    const state = {
      level: 1,
      xpCurrent: 0,
      xpLifetime: 0,
      seasonCap: 60,
      prestigeRank: 0,
      legacyPoints: 0,
      stats: { strength: 5, vitality: 5, intellect: 5, creativity: 5, discipline: 5, social: 5 }
    };

    const gain = xpToNext(1) + 10;
    const next = applyXp(state, gain);

    expect(next.level).toBe(2);
    expect(next.xpCurrent).toBe(10);
  });

  it("prestige grants legacy points from high levels", () => {
    const state = {
      level: 40,
      xpCurrent: 80,
      xpLifetime: 5000,
      seasonCap: 60,
      prestigeRank: 1,
      legacyPoints: 2,
      stats: { strength: 10, vitality: 10, intellect: 10, creativity: 10, discipline: 10, social: 10 }
    };

    const next = prestige(state);
    expect(next.level).toBe(1);
    expect(next.prestigeRank).toBe(2);
    expect(next.legacyPoints).toBeGreaterThan(state.legacyPoints);
  });
});
