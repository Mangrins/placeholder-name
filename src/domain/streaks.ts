import { differenceInCalendarDays, parseISO } from "date-fns";
import type { StreakState } from "./types";

function updateDayStreak(current: number, lastDay: string | undefined, today: string): number {
  if (!lastDay) {
    return 1;
  }

  const delta = differenceInCalendarDays(parseISO(today), parseISO(lastDay));
  if (delta === 0) {
    return current;
  }
  if (delta === 1) {
    return current + 1;
  }
  return 1;
}

export function updateTaskStreak(streak: StreakState, today: string): StreakState {
  return {
    ...streak,
    taskDays: updateDayStreak(streak.taskDays, streak.lastTaskDay, today),
    lastTaskDay: today
  };
}

export function updateFocusStreak(streak: StreakState, today: string): StreakState {
  return {
    ...streak,
    focusDays: updateDayStreak(streak.focusDays, streak.lastFocusDay, today),
    lastFocusDay: today
  };
}
