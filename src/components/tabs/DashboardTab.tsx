import React from "react";
import { StreakState, Achievement } from "../../domain/types";

interface QuestProgress {
  id: string;
  title: string;
  percent: number;
}

interface TimerSettings {
  workMin: number;
  breakMin: number;
  longBreakMin: number;
  everyN: number;
}

interface DashboardTabProps {
  activeQuestProgress: QuestProgress[];
  weeklyFocus: number;
  timerSettings: TimerSettings;
  weeklyCompletions: number;
  focusDayCompletionRate: number;
  peakHourIndex: number;
  streaks: StreakState | undefined;
  unlockedBadges: number;
  achievements: Achievement[];
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  activeQuestProgress,
  weeklyFocus,
  timerSettings,
  weeklyCompletions,
  focusDayCompletionRate,
  peakHourIndex,
  streaks,
  unlockedBadges,
  achievements,
}) => {
  return (
    <section className="panel-grid">
      <article className="panel">
        <h3>Quest Momentum</h3>
        {activeQuestProgress.slice(0, 4).map((quest) => (
          <div key={quest.id} className="progress-row">
            <span>{quest.title}</span>
            <span>{quest.percent}%</span>
          </div>
        ))}
        {activeQuestProgress.length === 0 && (
          <p className="muted">
            All tracked quests are complete. Create new custom quests.
          </p>
        )}
      </article>

      <article className="panel">
        <h3>Weekly Summary</h3>
        <div className="progress-row">
          <span>Focus minutes</span>
          <strong>{weeklyFocus}m</strong>
        </div>
        <div className="mini-progress">
          <span
            style={{
              width: `${Math.min(100, Math.round((weeklyFocus / Math.max(1, timerSettings.workMin * 7)) * 100))}%`,
            }}
          />
        </div>
        <div className="progress-row">
          <span>Task completions</span>
          <strong>{weeklyCompletions}</strong>
        </div>
        <div className="mini-progress">
          <span
            style={{
              width: `${Math.min(100, Math.round((weeklyCompletions / 28) * 100))}%`,
            }}
          />
        </div>
        <div className="progress-row">
          <span>Focus-day completion rate</span>
          <strong>{focusDayCompletionRate}%</strong>
        </div>
        <div className="mini-progress">
          <span style={{ width: `${focusDayCompletionRate}%` }} />
        </div>
        <div className="progress-row">
          <span>Peak hour</span>
          <strong>{String(peakHourIndex).padStart(2, "0")}:00</strong>
        </div>
      </article>

      <article className="panel">
        <h3>Immersion Status</h3>
        <p className="lead-text">
          Streaks: <strong>{streaks?.taskDays ?? 0}</strong> task days •{" "}
          <strong>{streaks?.focusDays ?? 0}</strong> focus days
        </p>
        <p className="lead-text">
          Badges unlocked: <strong>{unlockedBadges}</strong> /{" "}
          {achievements.length}
        </p>
        <p className="muted">
          Use custom quests and subtask-rich task planning to build stronger
          progression loops.
        </p>
      </article>
    </section>
  );
};
