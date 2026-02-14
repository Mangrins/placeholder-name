import type { Achievement, AppSettings, Category, Quest } from "../domain/types";

export const defaultCategories: Category[] = [
  {
    id: "training",
    name: "Training",
    statWeights: { strength: 0.6, vitality: 0.4 },
    xpMultiplier: 1,
    isDefault: true
  },
  {
    id: "learning",
    name: "Learning",
    statWeights: { intellect: 0.8, discipline: 0.2 },
    xpMultiplier: 1.05,
    isDefault: true
  },
  {
    id: "creativity",
    name: "Creativity",
    statWeights: { creativity: 0.8, intellect: 0.2 },
    xpMultiplier: 1.05,
    isDefault: true
  },
  {
    id: "social",
    name: "Social",
    statWeights: { social: 0.8, discipline: 0.2 },
    xpMultiplier: 1,
    isDefault: true
  },
  {
    id: "health",
    name: "Health",
    statWeights: { vitality: 0.8, discipline: 0.2 },
    xpMultiplier: 1.1,
    isDefault: true
  },
  {
    id: "admin",
    name: "Admin",
    statWeights: { discipline: 0.7, intellect: 0.3 },
    xpMultiplier: 0.95,
    isDefault: true
  }
];

const categoryChains: Achievement["category"][] = [
  "consistency",
  "deep_work",
  "balance",
  "mastery",
  "exploration",
  "recovery",
  "social",
  "health"
];

const tiers: Achievement["tier"][] = ["bronze", "silver", "gold", "legendary"];

export const defaultAchievements: Achievement[] = categoryChains.flatMap((category) =>
  ["path-a", "path-b"].flatMap((chain) =>
    tiers.map((tier, index) => ({
      id: `${category}-${chain}-${tier}`,
      category,
      chain,
      tier,
      title: `${category.replace("_", " ")} ${chain.toUpperCase()} ${tier.toUpperCase()}`,
      requirementType:
        category === "deep_work"
          ? "focus_minutes_total"
          : category === "consistency"
            ? "task_streak"
            : "tasks_completed",
      requirementValue: [10, 40, 120, 300][index]
    }))
  )
);

export const defaultQuestTemplates: Quest[] = [
  {
    id: "story-ch1",
    kind: "storyline",
    title: "Chapter 1: Awakening",
    objectiveType: "task_completions",
    target: 15,
    progress: 0,
    reward: { xp: 500, cosmeticId: "title-awakened" },
    status: "active"
  },
  {
    id: "boss-project-ascension",
    kind: "boss",
    title: "Boss Fight: Project Ascension (5 phases)",
    objectiveType: "task_completions",
    target: 25,
    progress: 0,
    reward: { xp: 800, cosmeticId: "frame-neon-aegis" },
    status: "active"
  }
];

export const defaultSettings: AppSettings = {
  timer: {
    workMin: 25,
    breakMin: 5,
    longBreakMin: 15,
    everyN: 4
  },
  themeId: "neon",
  staminaEnabled: false,
  audioEnabled: true,
  reducedMotion: false
};
