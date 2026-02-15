import { useState } from 'react';
import { Quest, Category } from '../../domain/types';
import { progressPercent } from '../../utils/appUtils';

interface UseQuestsTabProps {
  categories: Category[];
  quests: Quest[];
  createQuest: (quest: {
    title: string;
    kind: Quest["kind"];
    objectiveType: Quest["objectiveType"];
    target: number;
    rewardXp: number;
    objectiveCategoryId?: string;
  }) => Promise<void>;
  updateQuest: (id: string, updates: Partial<Quest>) => Promise<void>;
}

export const useQuestsTab = ({
  categories,
  quests,
  createQuest,
  updateQuest,
}: UseQuestsTabProps) => {
  const [questTitle, setQuestTitle] = useState("");
  const [questKind, setQuestKind] = useState<Quest["kind"]>("daily");
  const [questObjectiveType, setQuestObjectiveType] =
    useState<Quest["objectiveType"]>("task_completions");
  const [questTarget, setQuestTarget] = useState(3);
  const [questRewardXp, setQuestRewardXp] = useState(80);
  const [questCategoryId, setQuestCategoryId] = useState("");

  const submitQuest = async () => {
    if (!questTitle.trim()) return;

    await createQuest({
      title: questTitle.trim(),
      kind: questKind,
      objectiveType: questObjectiveType,
      target: questTarget,
      rewardXp: questRewardXp,
      objectiveCategoryId:
        questObjectiveType === "category_balance"
          ? questCategoryId || undefined
          : undefined,
    });

    setQuestTitle("");
  };

  return {
    // State
    questTitle,
    setQuestTitle,
    questKind,
    setQuestKind,
    questObjectiveType,
    setQuestObjectiveType,
    questTarget,
    setQuestTarget,
    questRewardXp,
    setQuestRewardXp,
    questCategoryId,
    setQuestCategoryId,

    // Functions
    submitQuest,

    // Data
    categories,
    quests,
    progressPercent,
    updateQuest,
  };
};