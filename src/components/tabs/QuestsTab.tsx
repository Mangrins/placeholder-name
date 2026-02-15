import React from "react";
import { Quest, Category } from "../../domain/types";

interface QuestsTabProps {
  questTitle: string;
  setQuestTitle: (value: string) => void;
  questKind: Quest["kind"];
  setQuestKind: (value: Quest["kind"]) => void;
  questObjectiveType: Quest["objectiveType"];
  setQuestObjectiveType: (value: Quest["objectiveType"]) => void;
  questCategoryId: string;
  setQuestCategoryId: (value: string) => void;
  questTarget: number;
  setQuestTarget: (value: number) => void;
  questRewardXp: number;
  setQuestRewardXp: (value: number) => void;
  submitQuest: () => Promise<void>;
  categories: Category[];
  quests: Quest[];
  progressPercent: (progress: number, target: number) => number;
  updateQuest: (id: string, updates: Partial<Quest>) => Promise<void>;
}

export const QuestsTab: React.FC<QuestsTabProps> = ({
  questTitle,
  setQuestTitle,
  questKind,
  setQuestKind,
  questObjectiveType,
  setQuestObjectiveType,
  questCategoryId,
  setQuestCategoryId,
  questTarget,
  setQuestTarget,
  questRewardXp,
  setQuestRewardXp,
  submitQuest,
  categories,
  quests,
  progressPercent,
  updateQuest,
}) => {
  return (
    <section className="panel-grid">
      <article className="panel">
        <h3>Create Custom Quest</h3>
        <div className="form-grid">
          <input
            value={questTitle}
            onChange={(event) => setQuestTitle(event.target.value)}
            placeholder="Quest title"
          />
          <select
            value={questKind}
            onChange={(event) =>
              setQuestKind(event.target.value as Quest["kind"])
            }
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="storyline">Storyline</option>
            <option value="boss">Boss</option>
          </select>
          <select
            value={questObjectiveType}
            onChange={(event) =>
              setQuestObjectiveType(
                event.target.value as Quest["objectiveType"],
              )
            }
          >
            <option value="task_completions">Task completions</option>
            <option value="focus_minutes">Focus minutes</option>
            <option value="category_balance">Category completions</option>
          </select>
          {questObjectiveType === "category_balance" && (
            <select
              value={questCategoryId}
              onChange={(event) => setQuestCategoryId(event.target.value)}
            >
              <option value="">Any category count</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          )}
          <div className="row">
            <input
              type="number"
              min={1}
              value={questTarget}
              onChange={(event) =>
                setQuestTarget(Math.max(1, Number(event.target.value)))
              }
            />
            <input
              type="number"
              min={1}
              value={questRewardXp}
              onChange={(event) =>
                setQuestRewardXp(Math.max(1, Number(event.target.value)))
              }
            />
          </div>
          <div className="row">
            <button onClick={() => void submitQuest()}>Create quest</button>
          </div>
        </div>
      </article>

      <article className="panel">
        <h3>Quest Log</h3>
        <div className="task-list">
          {quests.map((quest) => {
            const percent = progressPercent(quest.progress, quest.target);
            return (
              <div key={quest.id} className="quest-card">
                <div className="row space wrap">
                  <strong>{quest.title}</strong>
                  <span
                    className={quest.status === "complete" ? "badge" : "pill"}
                  >
                    {quest.status}
                  </span>
                </div>
                <div className="muted">
                  {quest.kind} • {quest.objectiveType.replace("_", " ")} •
                  reward {quest.reward.xp} XP
                </div>
                <div className="progress-bar">
                  <span style={{ width: `${percent}%` }} />
                </div>
                <div className="row space">
                  <small>
                    {quest.progress}/{quest.target}
                  </small>
                  {quest.status !== "complete" && (
                    <button
                      className="small"
                      onClick={() => {
                        void updateQuest(quest.id, {
                          status: "complete",
                          progress: quest.target,
                        });
                      }}
                    >
                      Mark complete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </article>
    </section>
  );
};
