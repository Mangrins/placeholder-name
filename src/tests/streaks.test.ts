import { describe, expect, it } from "vitest";
import { updateFocusStreak, updateTaskStreak } from "../domain/streaks";
import type { StreakState } from "../domain/types";

describe("streak logic", () => {
  it("increments streak on consecutive days and resets on gaps", () => {
    let streak: StreakState = { taskDays: 0, focusDays: 0, lastTaskDay: undefined, lastFocusDay: undefined };

    streak = updateTaskStreak(streak, "2026-02-10");
    expect(streak.taskDays).toBe(1);

    streak = updateTaskStreak(streak, "2026-02-11");
    expect(streak.taskDays).toBe(2);

    streak = updateTaskStreak(streak, "2026-02-13");
    expect(streak.taskDays).toBe(1);
  });

  it("does not double count same day", () => {
    let streak: StreakState = { taskDays: 0, focusDays: 2, lastTaskDay: undefined, lastFocusDay: "2026-02-12" };
    streak = updateFocusStreak(streak, "2026-02-12");
    expect(streak.focusDays).toBe(2);
  });
});
