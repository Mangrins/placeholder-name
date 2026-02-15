import React from "react";
import { Achievement, AchievementProgress } from "../../domain/types";

interface AchievementsTabProps {
  unlockedBadges: number;
  achievements: Achievement[];
  achievementProgress: Record<string, AchievementProgress>;
  progressPercent: (progress: number, target: number) => number;
}

export const AchievementsTab: React.FC<AchievementsTabProps> = ({
  unlockedBadges,
  achievements,
  achievementProgress,
  progressPercent,
}) => {
  return (
    <section className="panel">
      <h3>Trophy Room</h3>
      <p className="muted">
        Locked badges stay greyed out until requirements are met. Unlocked:{" "}
        {unlockedBadges}/{achievements.length}
      </p>
      <div className="badge-grid">
        {achievements.map((achievement) => {
          const progress = achievementProgress[achievement.id]?.value ?? 0;
          const unlockedAt = achievementProgress[achievement.id]?.unlockedAt;
          const unlocked = Boolean(unlockedAt);
          const percent = progressPercent(
            progress,
            achievement.requirementValue,
          );

          return (
            <article
              key={achievement.id}
              className={unlocked ? "badge-card" : "badge-card locked"}
            >
              <div className="row space">
                <strong>{achievement.title}</strong>
                <span className="badge">{achievement.tier}</span>
              </div>
              <div className="muted">
                {achievement.category.replace("_", " ")}
              </div>
              <div className="progress-bar" style={{ marginTop: "0.4rem" }}>
                <span style={{ width: `${percent}%` }} />
              </div>
              <div className="row space" style={{ marginTop: "0.4rem" }}>
                <small>
                  {progress}/{achievement.requirementValue}
                </small>
                <small>
                  {unlocked ? `Unlocked ${unlockedAt?.slice(0, 10)}` : "Locked"}
                </small>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
