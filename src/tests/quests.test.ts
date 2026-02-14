import { describe, expect, it } from "vitest";
import { generateDailyQuests } from "../domain/quests";

describe("adaptive quest generation", () => {
  it("targets neglected stat in daily quest", () => {
    const quests = generateDailyQuests({
      neglectedStats: ["social"],
      last14Days: [
        { date: "2026-02-01", focusMinutes: 20, completions: 2, xpGained: 30, categoryFocusMinutes: { learning: 20 } }
      ]
    });

    expect(quests[2].title.toLowerCase()).toContain("social");
  });
});
