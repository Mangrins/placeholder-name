import { db } from "./db";
import { defaultAchievements, defaultCategories, defaultQuestTemplates, defaultSettings } from "../seed/defaults";
import type { CharacterState } from "../domain/types";

const baseCharacter: CharacterState & { id: string } = {
  id: "main",
  level: 1,
  xpCurrent: 0,
  xpLifetime: 0,
  seasonCap: 60,
  prestigeRank: 0,
  legacyPoints: 0,
  stats: {
    strength: 5,
    vitality: 5,
    intellect: 5,
    creativity: 5,
    discipline: 5,
    social: 5
  }
};

export async function bootstrapData(): Promise<void> {
  if ((await db.categories.count()) === 0) {
    await db.categories.bulkAdd(defaultCategories);
  }

  if ((await db.achievements.count()) === 0) {
    await db.achievements.bulkAdd(defaultAchievements);
  }

  if ((await db.quests.count()) === 0) {
    await db.quests.bulkAdd(defaultQuestTemplates);
  }

  if ((await db.settings.count()) === 0) {
    await db.settings.add({ id: "main", ...defaultSettings });
  }

  if ((await db.character.count()) === 0) {
    await db.character.add(baseCharacter);
  }

  if ((await db.streaks.count()) === 0) {
    await db.streaks.add({ id: "main", taskDays: 0, focusDays: 0 });
  }
}
