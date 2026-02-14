import type { Category, CharacterState, Priority, StatDelta, StatKey } from "./types";

export interface TaskXpInput {
  priority: Priority;
  deadlineSoon: boolean;
  completedSubtasks: number;
  estimateMinutes: number;
  noveltyFactor?: number;
  sameCategoryCountToday: number;
  repeatedTitleCount24h: number;
  dailyXpBefore: number;
  level: number;
  categoryMultiplier?: number;
}

const priorityBonusMap: Record<Priority, number> = {
  low: 0,
  medium: 8,
  high: 16
};

export function xpToNext(level: number): number {
  return Math.round(120 + 35 * level + 10 * Math.pow(level, 1.35));
}

export function dailySoftCap(level: number): number {
  return 250 + level * 25;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateTaskXp(input: TaskXpInput): number {
  const base =
    20 +
    priorityBonusMap[input.priority] +
    (input.deadlineSoon ? 12 : 0) +
    Math.min(10, input.completedSubtasks * 2);

  const durationFactor = clamp(Math.log(1 + input.estimateMinutes / 15), 0.6, 1.8);
  const noveltyFactor = input.noveltyFactor ?? 1;
  const categoryMultiplier = input.categoryMultiplier ?? 1;

  let xp = base * durationFactor * noveltyFactor * categoryMultiplier;

  if (input.estimateMinutes < 5) {
    xp *= 0.35;
  }

  xp *= 1 / (1 + 0.12 * input.sameCategoryCountToday);
  xp *= Math.pow(0.8, input.repeatedTitleCount24h);

  const cap = dailySoftCap(input.level);
  if (input.dailyXpBefore > cap) {
    xp *= 0.4;
  }

  return Math.max(1, Math.round(xp));
}

export function calculateFocusXp(workMinutes: number, streakSessions = 0): number {
  const streakFactor = 1 + Math.min(0.15, streakSessions * 0.03);
  return Math.max(1, Math.round(workMinutes * 1.2 * streakFactor));
}

export function applyXp(state: CharacterState, xpGain: number): CharacterState {
  let level = state.level;
  let xpCurrent = state.xpCurrent + xpGain;

  while (xpCurrent >= xpToNext(level) && level < state.seasonCap) {
    xpCurrent -= xpToNext(level);
    level += 1;
  }

  return {
    ...state,
    level,
    xpCurrent,
    xpLifetime: state.xpLifetime + xpGain
  };
}

export function removeXp(state: CharacterState, xpLoss: number): CharacterState {
  let level = state.level;
  let xpCurrent = state.xpCurrent - Math.max(0, Math.round(xpLoss));

  while (xpCurrent < 0 && level > 1) {
    level -= 1;
    xpCurrent += xpToNext(level);
  }

  if (xpCurrent < 0) xpCurrent = 0;

  return {
    ...state,
    level,
    xpCurrent,
    xpLifetime: Math.max(0, state.xpLifetime - Math.max(0, Math.round(xpLoss)))
  };
}

function normalizeStatWeights(weights: Partial<Record<StatKey, number>>): Array<[StatKey, number]> {
  const entries = Object.entries(weights).filter((entry): entry is [StatKey, number] => {
    const value = entry[1];
    return typeof value === "number" && Number.isFinite(value) && value > 0;
  });
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) return [];
  return entries.map(([stat, value]) => [stat, value / total]);
}

export function calculateTaskStatGain(
  xpGain: number,
  priority: Priority,
  category?: Category,
  levelUps = 0
): StatDelta {
  const priorityMultiplier: Record<Priority, number> = {
    low: 0.85,
    medium: 1,
    high: 1.15
  };
  const scaledPoints = (xpGain / 36) * priorityMultiplier[priority];
  const basePoints = Math.max(1, Math.min(4, Math.round(scaledPoints)));
  const levelBonus = Math.max(0, Math.min(2, levelUps));
  const totalPoints = basePoints + levelBonus;

  const weights = normalizeStatWeights(category?.statWeights ?? {});
  const statGains: StatDelta = {};

  if (weights.length === 0) {
    statGains.discipline = totalPoints;
    return statGains;
  }

  let allocated = 0;
  for (const [stat, weight] of weights) {
    const points = Math.floor(totalPoints * weight);
    if (points <= 0) continue;
    statGains[stat] = (statGains[stat] ?? 0) + points;
    allocated += points;
  }

  const remainder = totalPoints - allocated;
  if (remainder > 0) {
    const primary = weights.slice().sort((a, b) => b[1] - a[1])[0]?.[0] ?? "discipline";
    statGains[primary] = (statGains[primary] ?? 0) + remainder;
  }

  return statGains;
}

export function applyStatGains(state: CharacterState, gains: StatDelta): CharacterState {
  const nextStats = { ...state.stats };
  for (const [stat, delta] of Object.entries(gains) as Array<[StatKey, number | undefined]>) {
    if (!delta || delta <= 0) continue;
    nextStats[stat] = (nextStats[stat] ?? 0) + Math.round(delta);
  }

  return {
    ...state,
    stats: nextStats
  };
}

export function revertStatGains(state: CharacterState, gains: StatDelta): CharacterState {
  const nextStats = { ...state.stats };
  for (const [stat, delta] of Object.entries(gains) as Array<[StatKey, number | undefined]>) {
    if (!delta || delta <= 0) continue;
    nextStats[stat] = Math.max(1, (nextStats[stat] ?? 1) - Math.round(delta));
  }
  return {
    ...state,
    stats: nextStats
  };
}

export function prestige(state: CharacterState): CharacterState {
  const legacyGain = Math.max(0, Math.floor((state.level - 20) / 5));

  return {
    ...state,
    level: 1,
    xpCurrent: 0,
    prestigeRank: state.prestigeRank + 1,
    legacyPoints: state.legacyPoints + legacyGain
  };
}
